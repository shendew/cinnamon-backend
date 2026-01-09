import crypto from 'crypto';
import { CryptoUtils } from './CryptoUtils.js';

// single block in the blockchain
export class Block {
    constructor({
        blockNumber,
        previousHash,
        transactions = [],
        timestamp = new Date(),
        nonce = 0,
        difficulty = 2,
        validatorUserId = null,
        validatorPublicKey = null,
        validatorSignature = null,
        hash = null,  // Accept pre-computed hash (for loading from DB)
        merkleRoot = null  // Accept pre-computed merkle root (for loading from DB)
    }) {
        this.blockNumber = blockNumber;
        this.previousHash = previousHash;
        this.transactions = transactions;
        this.timestamp = timestamp;
        this.nonce = nonce;
        this.difficulty = difficulty;
        this.validatorUserId = validatorUserId;
        this.validatorPublicKey = validatorPublicKey;
        this.validatorSignature = validatorSignature;
        this.merkleRoot = merkleRoot || this.calculateMerkleRoot();
        this.hash = hash || this.calculateHash();
    }

    // calculate hash of block data
    calculateHash() {
        const blockData = JSON.stringify({
            blockNumber: this.blockNumber,
            previousHash: this.previousHash,
            merkleRoot: this.merkleRoot,
            timestamp: this.timestamp.toISOString(),
            nonce: this.nonce,
            difficulty: this.difficulty,
            validatorUserId: this.validatorUserId,
            validatorPublicKey: this.validatorPublicKey
        });

        return crypto.createHash('sha256').update(blockData).digest('hex');
    }

    // mine block with proof-of-work
    mineBlock(difficulty = this.difficulty) {
        this.difficulty = difficulty;
        const target = '0'.repeat(difficulty);
        
        console.log(`[BC] Mining block ${this.blockNumber} with difficulty ${difficulty}...`);
        const startTime = Date.now();
        
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[BC] Block mined! Hash: ${this.hash}, Nonce: ${this.nonce}, Time: ${duration}s`);
        
        return this.hash;
    }

    // sign block with validator's private key
    signBlock(validatorPrivateKey, validatorPublicKey, validatorUserId) {
        if (!validatorPrivateKey || !validatorPublicKey) {
            throw new Error('Validator keys are required for block signing');
        }

        this.validatorUserId = validatorUserId;
        this.validatorPublicKey = validatorPublicKey;

        const blockData = {
            blockNumber: this.blockNumber,
            previousHash: this.previousHash,
            merkleRoot: this.merkleRoot,
            hash: this.hash,
            timestamp: this.timestamp.toISOString()
        };

        this.validatorSignature = CryptoUtils.signData(validatorPrivateKey, blockData);
        return this.validatorSignature;
    }

    // verify block signature
    verifyBlockSignature() {
        if (!this.validatorSignature || !this.validatorPublicKey) {
            return false;
        }

        const blockData = {
            blockNumber: this.blockNumber,
            previousHash: this.previousHash,
            merkleRoot: this.merkleRoot,
            hash: this.hash,
            timestamp: this.timestamp.toISOString()
        };

        return CryptoUtils.verifySignature(
            this.validatorPublicKey,
            blockData,
            this.validatorSignature
        );
    }


    // calculate merkle root from transactions
    calculateMerkleRoot() {
        if (this.transactions.length === 0) {
            return crypto.createHash('sha256').update('').digest('hex');
        }

        let hashes = this.transactions.map(tx => tx.hash || this.hashTransaction(tx));

        while (hashes.length > 1) {
            const newHashes = [];
      
            for (let i = 0; i < hashes.length; i += 2) {
                if (i + 1 < hashes.length) {
                    const combinedHash = crypto
                        .createHash('sha256')
                        .update(hashes[i] + hashes[i + 1])
                        .digest('hex');
                    newHashes.push(combinedHash);
                } else {
                    const combinedHash = crypto
                        .createHash('sha256')
                        .update(hashes[i] + hashes[i])
                        .digest('hex');
                    newHashes.push(combinedHash);
                }   
            }
      
            hashes = newHashes;
        }

        return hashes[0];
    }

    // hash transaction object
    hashTransaction(transaction) {
        const txData = JSON.stringify({
            transactionType: transaction.transactionType,
            batchNo: transaction.batchNo,
            actorUserId: transaction.actorUserId,
            actorRole: transaction.actorRole,
            transactionData: transaction.transactionData,
            timestamp: transaction.timestamp
        });

        return crypto.createHash('sha256').update(txData).digest('hex');
    }

    // validate block integrity
    isValid() {
        // verify hash integrity
        const recalculatedHash = this.calculateHash();
        if (this.hash !== recalculatedHash) {
            console.error(`[BC] Hash mismatch: ${this.hash} vs ${recalculatedHash}`);
            return false;
        }

        // verify merkle root
        const recalculatedMerkle = this.calculateMerkleRoot();
        if (this.merkleRoot !== recalculatedMerkle) {
            console.error(`[BC] Merkle root mismatch`);
            return false;
        }

        // verify proof-of-work (except genesis block)
        if (this.blockNumber > 0) {
            const target = '0'.repeat(this.difficulty);
            if (this.hash.substring(0, this.difficulty) !== target) {
                console.error(`[BC] Proof-of-work failed for block ${this.blockNumber}`);
                return false;
            }
        }

        // verify block signature if present
        if (this.validatorSignature && this.validatorPublicKey) {
            if (!this.verifyBlockSignature()) {
                console.error(`[BC] Block signature verification failed`);
                return false;
            }
        }

        // verify all transactions - skip crypto validation for loaded blocks
        const skipCryptoValidation = this.blockNumber === 0 || this.transactions.length > 0;
        for (const tx of this.transactions) {
            if (typeof tx.isValid === 'function' && !tx.isValid(skipCryptoValidation)) {
                console.error(`[BC] Invalid transaction found: ${tx.hash}`);
                return false;
            }
        }

        return true;
    }

    // convert block to JSON
    toJSON() {
        return {
            blockNumber: this.blockNumber,
            previousHash: this.previousHash,
            merkleRoot: this.merkleRoot,
            timestamp: this.timestamp,
            nonce: this.nonce,
            difficulty: this.difficulty,
            hash: this.hash,
            validatorUserId: this.validatorUserId,
            validatorPublicKey: this.validatorPublicKey,
            validatorSignature: this.validatorSignature,
            transactionCount: this.transactions.length,
            transactions: this.transactions
        };
    }

    //  create block from josn data
    static fromJSON(data) {
        return new Block({
            blockNumber: data.blockNumber,
            previousHash: data.previousHash,
            transactions: data.transactions || [],
            timestamp: new Date(data.timestamp),
            nonce: data.nonce || 0,
            difficulty: data.difficulty || 2,
            validatorUserId: data.validatorUserId,
            validatorPublicKey: data.validatorPublicKey,
            validatorSignature: data.validatorSignature
        });
    }
}
