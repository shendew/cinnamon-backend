import crypto from 'crypto';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1'); // Same curve as Bitcoin/Ethereum

// Enhanced utility class for cryptographic operations
export class CryptoUtils {
    
    // Generate new ECDSA key pair
    static generateKeyPair() {
        const keyPair = ec.genKeyPair();
        return {
            privateKey: keyPair.getPrivate('hex'),
            publicKey: keyPair.getPublic('hex')
        };
    }

    // Sign data with private key using ECDSA
    static signData(privateKey, data) {
        try {
            const keyPair = ec.keyFromPrivate(privateKey, 'hex');
            const hash = this.hash(data);
            const signature = keyPair.sign(hash, 'hex');
            return signature.toDER('hex');
        } catch (error) {
            throw new Error(`Signature generation failed: ${error.message}`);
        }
    }

    // Verify signature with public key
    static verifySignature(publicKey, data, signature) {
        try {
            const key = ec.keyFromPublic(publicKey, 'hex');
            const hash = this.hash(data);
            return key.verify(hash, signature);
        } catch (error) {
            console.error('[Crypto] Signature verification error:', error.message);
            return false;
        }
    }

    // Data hashing with SHA-256
    static hash(data) {
        return crypto
            .createHash('sha256')
            .update(typeof data === 'string' ? data : JSON.stringify(data))
            .digest('hex');
    }

    // Generate deterministic hash from multiple inputs
    static multiHash(...inputs) {
        const combined = inputs.map(i => 
            typeof i === 'string' ? i : JSON.stringify(i)
        ).join('');
        return this.hash(combined);
    }

    // Verify proof-of-work hash meets difficulty
    static meetsProofOfWork(hash, difficulty) {
        const target = '0'.repeat(difficulty);
        return hash.substring(0, difficulty) === target;
    }

    // Legacy HMAC method for backward compatibility (deprecated)
    static generateUserSignature(userId, data) {
        console.warn('[Crypto] DEPRECATED: Use ECDSA signatures instead of HMAC');
        const userSecret = process.env.JWT_SECRET + userId.toString();
        const hmac = crypto.createHmac('sha256', userSecret);
        hmac.update(typeof data === 'string' ? data : JSON.stringify(data));
        return hmac.digest('hex');
    }

    // Verify legacy HMAC signature (deprecated)
    static verifyUserSignature(userId, data, signature) {
        console.warn('[Crypto] DEPRECATED: Use verifySignature instead');
        const expectedSignature = this.generateUserSignature(userId, data);
        return signature === expectedSignature;
    }

    // Generate secure random nonce
    static generateNonce() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Create transaction signature payload
    static createTransactionPayload(txData) {
        return {
            transactionType: txData.transactionType,
            batchNo: txData.batchNo,
            actorUserId: txData.actorUserId,
            actorRole: txData.actorRole,
            transactionData: txData.transactionData,
            fromEntityId: txData.fromEntityId,
            toEntityId: txData.toEntityId,
            documentHashes: txData.documentHashes,
            timestamp: txData.timestamp instanceof Date ? txData.timestamp.toISOString() : txData.timestamp
        };
    }
}


// Helper class to create signed transactions
export class TransactionSigner {
    
    // Create ECDSA signed transaction
    static async createSignedTransaction({
        transactionType,
        batchNo,
        actorUserId,
        actorRole,
        privateKey,
        transactionData,
        fromEntityId = null,
        toEntityId = null,
        documentHashes = null
    }) {
        if (!privateKey) {
            throw new Error('Private key is required for transaction signing');
        }

        const timestamp = new Date();
        const payload = {
            transactionType,
            batchNo,
            actorUserId,
            actorRole,
            transactionData,
            fromEntityId,
            toEntityId,
            documentHashes,
            timestamp: timestamp.toISOString()
        };

        const signature = CryptoUtils.signData(privateKey, payload);

        return {
            ...payload,
            actorSignature: signature,
            timestamp
        };
    }

    // Create legacy HMAC signed transaction (backward compatibility)
    static async createLegacySignedTransaction({
        transactionType,
        batchNo,
        actorUserId,
        actorRole,
        transactionData,
        fromEntityId = null,
        toEntityId = null,
        documentHashes = null
    }) {
        console.warn('[TransactionSigner] DEPRECATED: Use createSignedTransaction with privateKey');
        
        const timestamp = new Date();
        const payload = {
            transactionType,
            batchNo,
            actorUserId,
            actorRole,
            transactionData,
            fromEntityId,
            toEntityId,
            documentHashes,
            timestamp: timestamp.toISOString()
        };

        const signature = CryptoUtils.generateUserSignature(actorUserId, payload);

        return {
            ...payload,
            actorSignature: signature,
            timestamp
        };
    }
}
