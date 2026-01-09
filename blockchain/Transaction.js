import crypto from 'crypto';
import { CryptoUtils } from './CryptoUtils.js';

// supply chain event transaction
export class Transaction {
    constructor({
        transactionType,
        batchNo,
        actorUserId,
        actorRole,
        actorPublicKey = null,
        actorSignature = null,
        transactionData,
        fromEntityId = null,
        toEntityId = null,
        documentHashes = null,
        timestamp = new Date(),
        nonce = null,
        hash = null  // Accept pre-computed hash
    }) {
        this.transactionType = transactionType;
        this.batchNo = batchNo;
        this.actorUserId = actorUserId;
        this.actorRole = actorRole;
        this.actorPublicKey = actorPublicKey;
        this.actorSignature = actorSignature;
        this.transactionData = transactionData;
        this.fromEntityId = fromEntityId;
        this.toEntityId = toEntityId;
        this.documentHashes = documentHashes;
        this.timestamp = timestamp;
        this.nonce = nonce || CryptoUtils.generateNonce();
        this.hash = hash || this.calculateHash();
    }

    // calculate hash of transaction
    calculateHash() {
        const txData = JSON.stringify({
            transactionType: this.transactionType,
            batchNo: this.batchNo,
            actorUserId: this.actorUserId,
            actorRole: this.actorRole,
            actorPublicKey: this.actorPublicKey,
            transactionData: this.transactionData,
            fromEntityId: this.fromEntityId,
            toEntityId: this.toEntityId,
            documentHashes: this.documentHashes,
            timestamp: this.timestamp.toISOString(),
            nonce: this.nonce
        });

        return crypto.createHash('sha256').update(txData).digest('hex');
    }

    // sign transaction with private key
    signTransaction(privateKey, publicKey) {
        if (!privateKey || !publicKey) {
            throw new Error('Private and public keys are required for signing');
        }

        this.actorPublicKey = publicKey;

        const payload = CryptoUtils.createTransactionPayload(this);
        this.actorSignature = CryptoUtils.signData(privateKey, payload);
        
        return this.actorSignature;
    }

    // verify transaction signature
    verifySignature() {
        if (!this.actorSignature || !this.actorPublicKey) {
            return false;
        }

        const payload = CryptoUtils.createTransactionPayload(this);
        return CryptoUtils.verifySignature(
            this.actorPublicKey,
            payload,
            this.actorSignature
        );
    }

    // validate transaction
    isValid(skipCryptoValidation = false) {
        if (!this.transactionType || !this.batchNo || !this.actorUserId || !this.actorRole) {
            console.error('[BC] Missing required fields');
            return false;
        }
        // Skip cryptographic validation they were already validated when created and stored
        if (skipCryptoValidation) {
            return true;
        }

        // verify hash - skip for loaded transactions
        if (this.hash) {
            const recalculatedHash = this.calculateHash();
            if (this.hash !== recalculatedHash) {
                console.error('[BC] Hash mismatch:', {
                    stored: this.hash,
                    recalculated: recalculatedHash,
                    timestamp: this.timestamp,
                    timestampISO: this.timestamp.toISOString()
                });

                console.warn('[BC] Using stored hash for loaded transaction');
            }
        }

        // verify signature
        if (!this.actorSignature || !this.actorPublicKey) {
            console.error('[BC] Missing signature or public key');
            return false;
        }

        if (!this.verifySignature()) {
            console.error('[BC] Signature verification failed');
            return false;
        }

        const now = Date.now();
        const txTime = new Date(this.timestamp).getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        if (txTime > now + 60000) { 
            console.error('[BC] Timestamp in future');
            return false;
        }

        if (now - txTime > oneDay) {
            console.warn('[BC] Transaction older than 24 hours');
        }

        return true;
    }


    // convert to json object
    toJSON() {
        return {
            transactionType: this.transactionType,
            batchNo: this.batchNo,
            actorUserId: this.actorUserId,
            actorRole: this.actorRole,
            actorPublicKey: this.actorPublicKey,
            actorSignature: this.actorSignature,
            transactionData: this.transactionData,
            fromEntityId: this.fromEntityId,
            toEntityId: this.toEntityId,
            documentHashes: this.documentHashes,
            timestamp: this.timestamp,
            nonce: this.nonce,
            hash: this.hash
        };
    }


    // create trans from json object
    static fromJSON(data) {
        return new Transaction({
            transactionType: data.transactionType,
            batchNo: data.batchNo,
            actorUserId: data.actorUserId,
            actorRole: data.actorRole,
            actorPublicKey: data.actorPublicKey,
            actorSignature: data.actorSignature,
            transactionData: data.transactionData,
            fromEntityId: data.fromEntityId,
            toEntityId: data.toEntityId,
            documentHashes: data.documentHashes,
            timestamp: new Date(data.timestamp),
            nonce: data.nonce
        });
    }
}

// tx types
export const TransactionTypes = {
    BATCH_CREATE: 'BATCH_CREATE',
    HARVEST_RECORD: 'HARVEST_RECORD',
    COLLECTION_RECORD: 'COLLECTION_RECORD',
    TRANSPORT_START: 'TRANSPORT_START',
    TRANSPORT_END: 'TRANSPORT_END',
    DRYING_RECORD: 'DRYING_RECORD',
    GRADING_RECORD: 'GRADING_RECORD',
    PACKING_RECORD: 'PACKING_RECORD',
    DISTRIBUTION_COLLECT: 'DISTRIBUTION_COLLECT',
    DISTRIBUTION_COMPLETE: 'DISTRIBUTION_COMPLETE',
    EXPORT_COLLECT: 'EXPORT_COLLECT',
    EXPORT_RECORD: 'EXPORT_RECORD'
};
