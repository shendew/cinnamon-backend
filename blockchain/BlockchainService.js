import { db } from '../config/db.js';
import { blockchain_blocks, blockchain_transactions, blockchain_metadata, batch_blockchain_refs } from '../src/db/schema.js';
import { Block } from './Block.js';
import { Transaction, TransactionTypes } from './Transaction.js';
import { Blockchain } from './Blockchain.js';
import { KeyManager } from './KeyManager.js';
import { eq } from 'drizzle-orm';


export class BlockchainService {
    constructor() {
        this.blockchain = new Blockchain();
        this.initialized = false;
        this.rateLimitMap = new Map(); // userId -> {count, resetTime}
        this.rateLimitWindow = 60000; // 1 minute
        this.rateLimitMax = 100; // max 100 transactions per minute per user
        this.healthCheckInterval = null;
        this.lastIntegrityCheck = null;
    }

    // initialize
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            console.log('[BC] Initializing...');
            await this.loadFromDatabase();

            if (this.blockchain.chain.length === 0) {
                console.log('[BC] Creating genesis block...');
                await this.createGenesisBlock();
            }

            await this.loadValidators();

            const isValid = this.blockchain.isChainValid();
            if (!isValid) {
                console.error('[BC] WARNING: Chain validation failed!');
            }

            console.log(`[BC] Initialized. Blocks: ${this.blockchain.chain.length}`);
            this.initialized = true;
            
            // start health monitoring
            this.startHealthMonitoring();
            
        } catch (error) {
            console.error('[BC] Initialization error:', error.message);
            this.initialized = false;
            throw error;
        }
    }

    // load blockchain from database
    async loadFromDatabase() {
        try {
            const blocks = await db.select().from(blockchain_blocks).orderBy(blockchain_blocks.block_number);

            for (const blockData of blocks) {
                const txs = await db.select().from(blockchain_transactions).where(eq(blockchain_transactions.block_id, blockData.block_id)).orderBy(blockchain_transactions.transaction_id);

                const transactions = txs.map(txData => {
                    const tx = new Transaction({
                        transactionType: txData.transaction_type,
                        batchNo: txData.batch_no,
                        actorUserId: txData.actor_user_id,
                        actorRole: txData.actor_role,
                        actorPublicKey: txData.actor_public_key,
                        actorSignature: txData.actor_signature,
                        transactionData: txData.transaction_data,
                        fromEntityId: txData.from_entity_id,
                        toEntityId: txData.to_entity_id,
                        documentHashes: txData.document_hashes,
                        timestamp: new Date(txData.timestamp),
                        nonce: txData.nonce,
                        hash: txData.transaction_hash  // Use stored hash
                    });
                    
                    this.blockchain.processedTransactions.add(tx.hash);
                    
                    return tx;
                });

                const block = new Block({
                    blockNumber: blockData.block_number,
                    previousHash: blockData.previous_hash,
                    transactions,
                    timestamp: new Date(blockData.timestamp),
                    nonce: blockData.nonce,
                    difficulty: blockData.difficulty || 2,
                    validatorUserId: blockData.validator_user_id,
                    validatorPublicKey: blockData.validator_public_key,
                    validatorSignature: blockData.validator_signature,
                    hash: blockData.block_hash,  // Use stored hash
                    merkleRoot: blockData.merkle_root  // Use stored merkle root
                });

                this.blockchain.chain.push(block);
            }

            console.log(`[BC] Loaded ${blocks.length} blocks from database`);
        } catch (error) {
            console.error('[BC] Error loading from database:', error);
        }
    }

    // load validators from metadata
    async loadValidators() {
        try {
            const validatorData = await db.select().from(blockchain_metadata).where(eq(blockchain_metadata.key, 'validators'));

            if (validatorData.length > 0) {
                const validators = JSON.parse(validatorData[0].value);
                validators.forEach(validatorId => {
                    this.blockchain.addValidator(validatorId);
                });
            } else {
                this.blockchain.addValidator(1);
                await this.saveValidators();
            }
        } catch (error) {
            console.error('[BC] Error loading validators:', error.message);
        }
    }

    // save validators in db
    async saveValidators() {
        try {
            const validators = Array.from(this.blockchain.validators);
      
            const existing = await db.select().from(blockchain_metadata).where(eq(blockchain_metadata.key, 'validators'));

            if (existing.length > 0) {
                await db.update(blockchain_metadata).set({
                    value: JSON.stringify(validators),
                    updated_at: new Date()
                }).where(eq(blockchain_metadata.key, 'validators'));
            } else {
                await db.insert(blockchain_metadata).values({
                    key: 'validators',
                    value: JSON.stringify(validators),
                    description: 'Authorized blockchain validators'
                });
            }
        } catch (error) {
            console.error('[BC] Error saving validators:', error.message);
        }
    }


    // create genesis block with proper initialization
    async createGenesisBlock() {
        const genesisBlock = this.blockchain.createGenesisBlock();
    
        try {
            await db.insert(blockchain_blocks).values({
                block_number: genesisBlock.blockNumber,
                previous_hash: genesisBlock.previousHash,
                merkle_root: genesisBlock.merkleRoot,
                timestamp: new Date(genesisBlock.timestamp).toISOString(),
                nonce: genesisBlock.nonce,
                difficulty: 0,
                block_hash: genesisBlock.hash,
                validator_user_id: null,
                validator_public_key: null,
                validator_signature: null,
                transaction_count: 0,
                is_valid: true
            });

            console.log('[BC] Genesis block created:', genesisBlock.hash);
        } catch (error) {
            console.error('[BC] Error creating genesis block:', error);
            throw error;
        }
    
        return genesisBlock;
    }

    // add transaction with enhanced validation and rate limiting
    async addTransaction(transaction, autoCreateBlock = true, validatorUserId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            if (!this.checkRateLimit(transaction.actorUserId)) {
                throw new Error('Rate limit exceeded. Too many transactions in short time.');
            }

            // add transaction to blockchain
            this.blockchain.addTransaction(transaction);

            let block = null;
            if (autoCreateBlock) {
                // get validator keys if provided
                let validatorPrivateKey = null;
                let validatorPublicKey = null;
                
                if (validatorUserId) {
                    try {
                        validatorPrivateKey = await KeyManager.getPrivateKey(validatorUserId);
                        validatorPublicKey = await KeyManager.getPublicKey(validatorUserId);
                    } catch (error) {
                        console.warn('[BC] Could not load validator keys, block will not be signed');
                    }
                }
                
                block = this.blockchain.forceCreateBlock(
                    validatorUserId,
                    validatorPrivateKey,
                    validatorPublicKey
                );
        
                if (block) {
                    await this.persistBlock(block);
                }
            }

            return {
                success: true,
                transaction,
                block,
                pending: !block
            };
        } catch (error) {
            console.error('[BC] Error adding transaction:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // rate limiting check
    checkRateLimit(userId) {
        const now = Date.now();
        const userLimit = this.rateLimitMap.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            this.rateLimitMap.set(userId, {
                count: 1,
                resetTime: now + this.rateLimitWindow
            });
            return true;
        }

        if (userLimit.count >= this.rateLimitMax) {
            console.warn(`[BC] Rate limit exceeded for user ${userId}`);
            return false;
        }

        userLimit.count++;
        return true;
    }

    // persist block
    async persistBlock(block) {
        try {
            await db.transaction(async (tx) => {
                const blockResult = await tx.insert(blockchain_blocks).values({
                    block_number: block.blockNumber,
                    previous_hash: block.previousHash,
                    merkle_root: block.merkleRoot,
                    timestamp: new Date(block.timestamp).toISOString(),
                    nonce: block.nonce,
                    difficulty: block.difficulty,
                    block_hash: block.hash,
                    validator_user_id: block.validatorUserId,
                    validator_public_key: block.validatorPublicKey,
                    validator_signature: block.validatorSignature,
                    transaction_count: block.transactions.length,
                    is_valid: true
                }).returning();

                const blockId = blockResult[0].block_id;

                for (const transaction of block.transactions) {
                    const txResult = await tx.insert(blockchain_transactions).values({
                        transaction_hash: transaction.hash,
                        block_id: blockId,
                        transaction_type: transaction.transactionType,
                        batch_no: transaction.batchNo,
                        actor_user_id: transaction.actorUserId,
                        actor_role: transaction.actorRole,
                        actor_public_key: transaction.actorPublicKey,
                        actor_signature: transaction.actorSignature,
                        transaction_data: transaction.transactionData,
                        from_entity_id: transaction.fromEntityId,
                        to_entity_id: transaction.toEntityId,
                        document_hashes: transaction.documentHashes,
                        nonce: transaction.nonce,
                        timestamp: new Date(transaction.timestamp).toISOString(),
                        is_verified: true,
                        verification_count: 1
                    }).returning();

                    const stage = this.getStageFromTransactionType(transaction.transactionType);
                    if (stage) {
                        await tx.insert(batch_blockchain_refs).values({
                            batch_no: transaction.batchNo,
                            stage: stage,
                            transaction_id: txResult[0].transaction_id,
                            block_id: blockId,
                            transaction_hash: transaction.hash
                        });
                    }
                }
            });

            console.log(`[BC] Block ${block.blockNumber} persisted with ${block.transactions.length} transactions`);
        } catch (error) {
            console.error('[BC] Error persisting block:', error.message);
            throw error;
        }
    }

    // transaction type mapping to stage
    getStageFromTransactionType(txType) {
        const mapping = {
            'BATCH_CREATE': 'cultivation',
            'HARVEST_RECORD': 'harvest',
            'COLLECTION_RECORD': 'collection',
            'TRANSPORT_START': 'transport',
            'TRANSPORT_END': 'transport',
            'DRYING_RECORD': 'process',
            'GRADING_RECORD': 'process',
            'PACKING_RECORD': 'process',
            'DISTRIBUTION_COLLECT': 'distribute',
            'DISTRIBUTION_COMPLETE': 'distribute',
            'EXPORT_COLLECT': 'export',
            'EXPORT_RECORD': 'export'
        };

        return mapping[txType] || null;
    }

    // get batch history from chain
    async getBatchHistory(batchNo) {
        // check whether initalozed or not
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const txs = await db.select({
                    transaction: blockchain_transactions,
                    block: blockchain_blocks
                })
                .from(blockchain_transactions)
                .innerJoin(
                    blockchain_blocks,
                    eq(blockchain_transactions.block_id, blockchain_blocks.block_id)
                )
                .where(eq(blockchain_transactions.batch_no, batchNo))
                .orderBy(blockchain_transactions.timestamp);

            return txs.map(({ transaction, block }) => ({
                transactionHash: transaction.transaction_hash,
                transactionType: transaction.transaction_type,
                batchNo: transaction.batch_no,
                actorUserId: transaction.actor_user_id,
                actorRole: transaction.actor_role,
                transactionData: transaction.transaction_data,
                documentHashes: transaction.document_hashes,
                timestamp: transaction.timestamp,
                blockNumber: block.block_number,
                blockHash: block.block_hash,
                blockTimestamp: block.timestamp,
                isVerified: transaction.is_verified
            }));
        } catch (error) {
            console.error('[BC] Error getting batch history:', error.message);
            return [];
        }
    }

    // gtet blockchain stats
    async getStats() {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.blockchain.getStats();
    }

    // validator
    async addValidator(userId) {
        this.blockchain.addValidator(userId);
        await this.saveValidators();
    }

    // check if validator
    isValidator(userId) {
        return this.blockchain.isValidator(userId);
    }

    // get all blocks in the blockchain
    async getAllBlocks() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const blocks = await db.select()
                .from(blockchain_blocks)
                .orderBy(blockchain_blocks.block_number);

            return blocks.map(block => ({
                blockId: block.block_id,
                blockNumber: block.block_number,
                previousHash: block.previous_hash,
                merkleRoot: block.merkle_root,
                timestamp: block.timestamp,
                nonce: block.nonce,
                blockHash: block.block_hash,
                validatorUserId: block.validator_user_id,
                validatorSignature: block.validator_signature,
                transactionCount: block.transaction_count,
                isValid: block.is_valid,
                createdAt: block.created_at
            }));
        } catch (error) {
            console.error('[BC] Error getting all blocks:', error.message);
            return [];
        }
    }

    // get all transactions across all blocks
    async getAllTransactions() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const transactions = await db.select({
                    transaction: blockchain_transactions,
                    block: blockchain_blocks
                })
                .from(blockchain_transactions)
                .innerJoin(
                    blockchain_blocks,
                    eq(blockchain_transactions.block_id, blockchain_blocks.block_id)
                )
                .orderBy(blockchain_transactions.timestamp);

            return transactions.map(({ transaction, block }) => ({
                transactionId: transaction.transaction_id,
                transactionHash: transaction.transaction_hash,
                transactionType: transaction.transaction_type,
                batchNo: transaction.batch_no,
                actorUserId: transaction.actor_user_id,
                actorRole: transaction.actor_role,
                actorSignature: transaction.actor_signature,
                transactionData: transaction.transaction_data,
                fromEntityId: transaction.from_entity_id,
                toEntityId: transaction.to_entity_id,
                documentHashes: transaction.document_hashes,
                timestamp: transaction.timestamp,
                isVerified: transaction.is_verified,
                verificationCount: transaction.verification_count,
                blockNumber: block.block_number,
                blockHash: block.block_hash,
                blockTimestamp: block.timestamp
            }));
        } catch (error) {
            console.error('[BC] Error getting all transactions:', error.message);
            return [];
        }
    }

    // get blockchain stats
    async getBlockchainStats() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const totalBlocks = await db.select().from(blockchain_blocks);
            const totalTransactions = await db.select().from(blockchain_transactions);
            
            return {
                totalBlocks: totalBlocks.length,
                totalTransactions: totalTransactions.length,
                validators: Array.from(this.blockchain.validators),
                isChainValid: this.blockchain.isChainValid(),
                latestBlock: totalBlocks.length > 0 ? totalBlocks[totalBlocks.length - 1].block_number : 0
            };
        } catch (error) {
            console.error('[BC] Error getting blockchain stats:', error.message);
            return {
                totalBlocks: 0,
                totalTransactions: 0,
                validators: [],
                isChainValid: false,
                latestBlock: 0
            };
        }
    }

    // validate entire chain
    async validateChain() {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.blockchain.isChainValid();
    }

    // get block by number
    async getBlockByNumber(blockNumber) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const blocks = await db.select()
                .from(blockchain_blocks)
                .where(eq(blockchain_blocks.block_number, blockNumber));

            if (blocks.length === 0) {
                return null;
            }

            const block = blocks[0];
            const transactions = await db.select()
                .from(blockchain_transactions)
                .where(eq(blockchain_transactions.block_id, block.block_id));

            return {
                blockId: block.block_id,
                blockNumber: block.block_number,
                previousHash: block.previous_hash,
                merkleRoot: block.merkle_root,
                timestamp: block.timestamp,
                nonce: block.nonce,
                blockHash: block.block_hash,
                validatorUserId: block.validator_user_id,
                validatorSignature: block.validator_signature,
                transactionCount: block.transaction_count,
                isValid: block.is_valid,
                createdAt: block.created_at,
                transactions: transactions.map(tx => ({
                    transactionId: tx.transaction_id,
                    transactionHash: tx.transaction_hash,
                    transactionType: tx.transaction_type,
                    batchNo: tx.batch_no,
                    actorUserId: tx.actor_user_id,
                    actorRole: tx.actor_role,
                    transactionData: tx.transaction_data,
                    timestamp: tx.timestamp
                }))
            };
        } catch (error) {
            console.error('[BC] Error getting block by number:', error.message);
            return null;
        }
    }

    // get transaction by hash
    async getTransactionByHash(hash) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const transactions = await db.select({
                    transaction: blockchain_transactions,
                    block: blockchain_blocks
                })
                .from(blockchain_transactions)
                .innerJoin(
                    blockchain_blocks,
                    eq(blockchain_transactions.block_id, blockchain_blocks.block_id)
                )
                .where(eq(blockchain_transactions.transaction_hash, hash));

            if (transactions.length === 0) {
                return null;
            }

            const { transaction, block } = transactions[0];

            return {
                transactionId: transaction.transaction_id,
                transactionHash: transaction.transaction_hash,
                transactionType: transaction.transaction_type,
                batchNo: transaction.batch_no,
                actorUserId: transaction.actor_user_id,
                actorRole: transaction.actor_role,
                actorSignature: transaction.actor_signature,
                transactionData: transaction.transaction_data,
                fromEntityId: transaction.from_entity_id,
                toEntityId: transaction.to_entity_id,
                documentHashes: transaction.document_hashes,
                timestamp: transaction.timestamp,
                isVerified: transaction.is_verified,
                verificationCount: transaction.verification_count,
                blockNumber: block.block_number,
                blockHash: block.block_hash,
                blockTimestamp: block.timestamp
            };
        } catch (error) {
            console.error('[BC] Error getting transaction by hash:', error.message);
            return null;
        }
    }

    // get batch blockchain reference
    async getBatchBlockchainReference(batchNo) {
        try {
            const refs = await db.select()
                .from(batch_blockchain_refs)
                .where(eq(batch_blockchain_refs.batch_no, batchNo))
                .orderBy(batch_blockchain_refs.created_at);

            if (refs.length === 0) {
                return null;
            }

            return {
                batchNo,
                currentStage: refs[refs.length - 1].stage,
                totalRecords: refs.length,
                stages: refs.map(ref => ({
                    stage: ref.stage,
                    transactionId: ref.transaction_id,
                    transactionHash: ref.transaction_hash,
                    createdAt: ref.created_at
                }))
            };
        } catch (error) {
            console.error('[BC] Error getting batch blockchain reference:', error.message);
            return null;
        }
    }

    // health monitoring
    startHealthMonitoring() {
        if (this.healthCheckInterval) {
            return;
        }

        console.log('[BC] Starting health monitoring...');
        
        // run integrity check every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performIntegrityCheckWithRecovery();
            } catch (error) {
                console.error('[BC] Health check failed:', error.message);
            }
        }, 5 * 60 * 1000);

        this.performIntegrityCheckWithRecovery();
    }

    // destroy health monitoring
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('[BC] Health monitoring stopped');
        }
    }

    // perform comprehensive integrity check
    async performIntegrityCheck() {
        const startTime = Date.now();
        console.log('[BC] Performing integrity check...');

        try {
            const issues = [];

            // validate chain
            if (!this.blockchain.isChainValid()) {
                issues.push('Chain validation failed');
            }

            // check database consistency
            const dbBlocks = await db.select().from(blockchain_blocks);
            if (dbBlocks.length !== this.blockchain.chain.length) {
                issues.push(`Block count mismatch: DB=${dbBlocks.length}, Chain=${this.blockchain.chain.length}`);
            }

            // verify latest block hash
            if (this.blockchain.chain.length > 0) {
                const latestBlock = this.blockchain.getLatestBlock();
                const dbLatest = dbBlocks[dbBlocks.length - 1];
                
                if (latestBlock.hash !== dbLatest.block_hash) {
                    const mismatchMsg = `Latest block hash mismatch - Chain: ${latestBlock.hash.substring(0, 16)}..., DB: ${dbLatest.block_hash.substring(0, 16)}... (Block #${latestBlock.blockNumber})`;
                    issues.push(mismatchMsg);
                    console.warn('[BC] Hash mismatch details:', {
                        blockNumber: latestBlock.blockNumber,
                        chainHash: latestBlock.hash,
                        dbHash: dbLatest.block_hash,
                        chainTimestamp: latestBlock.timestamp,
                        dbTimestamp: dbLatest.timestamp
                    });
                }
            }

            // store results
            this.lastIntegrityCheck = {
                timestamp: new Date(),
                duration: Date.now() - startTime,
                passed: issues.length === 0,
                issues: issues
            };

            if (issues.length > 0) {
                console.error('[BC] Integrity check FAILED:', issues);
            } else {
                console.log(`[BC] Integrity check PASSED (${this.lastIntegrityCheck.duration}ms)`);
            }

            return this.lastIntegrityCheck;
        } catch (error) {
            console.error('[BC] Integrity check error:', error.message);
            this.lastIntegrityCheck = {
                timestamp: new Date(),
                duration: Date.now() - startTime,
                passed: false,
                error: error.message
            };
            return this.lastIntegrityCheck;
        }
    }

    // get health status
    getHealthStatus() {
        return {
            initialized: this.initialized,
            chainValid: this.blockchain.isChainValid(),
            totalBlocks: this.blockchain.chain.length,
            pendingTransactions: this.blockchain.pendingTransactions.length,
            currentDifficulty: this.blockchain.difficulty,
            validatorCount: this.blockchain.validators.size,
            lastIntegrityCheck: this.lastIntegrityCheck,
            rateLimitActiveUsers: this.rateLimitMap.size
        };
    }

    // clear rate limits (admin function)
    clearRateLimits() {
        this.rateLimitMap.clear();
        console.log('[BC] Rate limits cleared');
    }

    // get validator info with key status
    async getValidatorInfo(userId) {
        const isValidator = this.blockchain.isValidator(userId);
        const hasKeys = await KeyManager.hasKeys(userId);
        const keyInfo = await KeyManager.getKeyInfo(userId);

        return {
            userId,
            isValidator,
            hasKeys,
            keyInfo
        };
    }

    // reload chain from database (recovery mechanism)
    async reloadChain() {
        console.log('[BC] Reloading blockchain from database...');
        try {
            this.blockchain.chain = [];
            this.blockchain.pendingTransactions = [];
            this.blockchain.processedTransactions.clear();
            
            await this.loadFromDatabase();
            
            const isValid = this.blockchain.isChainValid();
            console.log(`[BC] Chain reloaded. Blocks: ${this.blockchain.chain.length}, Valid: ${isValid}`);
            
            return {
                success: true,
                blockCount: this.blockchain.chain.length,
                isValid
            };
        } catch (error) {
            console.error('[BC] Error reloading chain:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Reset blockchain completely (drop all blocks and reinitialize)
    async resetBlockchain() {
        console.log('[BC] RESETTING BLOCKCHAIN - ALL DATA WILL BE DELETED...');
        try {
            // Delete all blockchain data from database
            await db.delete(batch_blockchain_refs);
            await db.delete(blockchain_transactions);
            await db.delete(blockchain_blocks);
            
            console.log('[BC] All blockchain data deleted from database');
            
            // Clear in-memory chain
            this.blockchain.chain = [];
            this.blockchain.pendingTransactions = [];
            this.blockchain.processedTransactions.clear();
            this.initialized = false;
            
            // Reinitialize with fresh genesis block
            await this.initialize();
            
            console.log('[BC] Blockchain reset complete');
            
            return {
                success: true,
                blockCount: this.blockchain.chain.length,
                message: 'Blockchain reset and reinitialized with genesis block'
            };
        } catch (error) {
            console.error('[BC] Error resetting blockchain:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // reload chain if integrity check fails
    async performIntegrityCheckWithRecovery() {
        const result = await this.performIntegrityCheck();
        
        if (!result.passed && result.issues && result.issues.length > 0) {
            console.log('[BC] Attempting auto-recovery...');
            const reloadResult = await this.reloadChain();
            
            if (reloadResult.success) {
                const recheckResult = await this.performIntegrityCheck();
                console.log('[BC] Post-recovery integrity check:', recheckResult.passed ? 'PASSED' : 'FAILED');
                return recheckResult;
            }
        }
        
        return result;
    }

    // cleanup on shutdown
    shutdown() {
        console.log('[BC] Shutting down blockchain service...');
        this.stopHealthMonitoring();
        this.clearRateLimits();
    }
}


export const blockchainService = new BlockchainService();
export { TransactionTypes, KeyManager };
