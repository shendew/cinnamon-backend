import { Block } from './Block.js';

// blockchain manager with proof-of-work
export class Blockchain {
    constructor() {
        this.chain = [];
        this.pendingTransactions = [];
        this.blockSize = 5000; // transactions per block
        this.validators = new Set();
        this.difficulty = 2; // initial difficulty
        this.targetBlockTime = 10000; // 10 seconds target
        this.difficultyAdjustmentInterval = 10; // adjust every 10 blocks
        this.processedTransactions = new Set(); // prevent replay attacks
    }

    // Create genesis block
    createGenesisBlock() {
        const genesisBlock = new Block({
            blockNumber: 0,
            previousHash: '0',
            transactions: [],
            timestamp: new Date(),
            nonce: 0,
            difficulty: 0 // Genesis doesn't need mining
        });

        this.chain.push(genesisBlock);
        return genesisBlock;
    }

    getLatestBlock() {
        if (this.chain.length === 0) {
            return null;
        }
        return this.chain[this.chain.length - 1];
    }

    // add validator
    addValidator(userId) {
        this.validators.add(userId);
    }

    // check if user is validator
    isValidator(userId) {
        return this.validators.has(userId);
    }

    // add transaction to pending pool with validation
    addTransaction(transaction) {
        if (!transaction.isValid()) {
            throw new Error('Cannot add invalid transaction');
        }

        // prevent replay attacks
        if (this.processedTransactions.has(transaction.hash)) {
            throw new Error('Transaction already processed (replay attack prevented)');
        }

        this.pendingTransactions.push(transaction);
        this.processedTransactions.add(transaction.hash);

        // auto-create block if threshold reached
        if (this.pendingTransactions.length >= this.blockSize) {
            return this.createBlock();
        }

        return null;
    }

    // adjust mining difficulty based on block times
    adjustDifficulty() {
        if (this.chain.length < this.difficultyAdjustmentInterval) {
            return this.difficulty;
        }

        if (this.chain.length % this.difficultyAdjustmentInterval !== 0) {
            return this.difficulty;
        }

        const recentBlocks = this.chain.slice(-this.difficultyAdjustmentInterval);
        const timeSpan = new Date(recentBlocks[recentBlocks.length - 1].timestamp) - 
                        new Date(recentBlocks[0].timestamp);
        
        const expectedTime = this.targetBlockTime * this.difficultyAdjustmentInterval;
        
        if (timeSpan < expectedTime / 2) {
            this.difficulty++;
            console.log(`[BC] Difficulty increased to ${this.difficulty}`);
        } else if (timeSpan > expectedTime * 2) {
            this.difficulty = Math.max(1, this.difficulty - 1);
            console.log(`[BC] Difficulty decreased to ${this.difficulty}`);
        }

        return this.difficulty;
    }

    // create new block with mining
    createBlock(validatorUserId = null, validatorPrivateKey = null, validatorPublicKey = null) {
        if (this.pendingTransactions.length === 0) {
            return null;
        }

        const latestBlock = this.getLatestBlock();
        const blockNumber = latestBlock ? latestBlock.blockNumber + 1 : 0;
        const previousHash = latestBlock ? latestBlock.hash : '0';

        const currentDifficulty = this.adjustDifficulty();

        const transactions = this.pendingTransactions.splice(0, this.blockSize);

        const newBlock = new Block({
            blockNumber,
            previousHash,
            transactions,
            timestamp: new Date(),
            nonce: 0,
            difficulty: currentDifficulty,
            validatorUserId,
            validatorPublicKey
        });

        // mine the block (proof-of-work)
        if (blockNumber > 0) {
            newBlock.mineBlock(currentDifficulty);
        }

        // sign block if validator keys provided
        if (validatorPrivateKey && validatorPublicKey && validatorUserId) {
            newBlock.signBlock(validatorPrivateKey, validatorPublicKey, validatorUserId);
        }

        this.chain.push(newBlock);

        return newBlock;
    }

    // force create block with current pending transactions
    forceCreateBlock(validatorUserId = null, validatorPrivateKey = null, validatorPublicKey = null) {
        if (this.pendingTransactions.length === 0) {
            return null;
        }

        return this.createBlock(validatorUserId, validatorPrivateKey, validatorPublicKey);
    }

    // comprehensive chain validation
    isChainValid() {
        if (this.chain.length === 0) {
            return false;
        }

        // validate genesis block
        if (this.chain[0].previousHash !== '0') {
            console.error('[BC] Invalid genesis block');
            return false;
        }

        // validate each block
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // validate block itself
            if (!currentBlock.isValid()) {
                console.error(`[BC] Block ${i} validation failed`);
                return false;
            }

            // check previous hash linkage
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.error(`[BC] Block ${i} previous hash mismatch`);
                return false;
            }

            // check block number sequence
            if (currentBlock.blockNumber !== previousBlock.blockNumber + 1) {
                console.error(`[BC] Block ${i} number sequence broken`);
                return false;
            }

            // verify proof-of-work
            const target = '0'.repeat(currentBlock.difficulty);
            if (currentBlock.hash.substring(0, currentBlock.difficulty) !== target) {
                console.error(`[BC] Block ${i} proof-of-work invalid`);
                return false;
            }
        }

        return true;
    }

    // get transactions by batch
    getTransactionsByBatch(batchNo) {
        const transactions = [];

        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.batchNo === batchNo) {
                    transactions.push({
                        ...tx,
                        blockNumber: block.blockNumber,
                        blockHash: block.hash,
                        blockTimestamp: block.timestamp
                    });
                }
            }
        }

        return transactions.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
    }

    // get block by number
    getBlockByNumber(blockNumber) {
        return this.chain.find(block => block.blockNumber === blockNumber);
    }

    // get blockchain statistics
    getStats() {
        const totalBlocks = this.chain.length;
        const totalTransactions = this.chain.reduce(
            (sum, block) => sum + block.transactions.length, 
            0
        );
        const pendingCount = this.pendingTransactions.length;
        const latestBlock = this.getLatestBlock();

        return {
            totalBlocks,
            totalTransactions,
            pendingTransactions: pendingCount,
            currentDifficulty: this.difficulty,
            latestBlockNumber: latestBlock ? latestBlock.blockNumber : null,
            latestBlockHash: latestBlock ? latestBlock.hash : null,
            isValid: this.isChainValid(),
            validatorCount: this.validators.size,
            processedTransactionsCount: this.processedTransactions.size
        };
    }
}
