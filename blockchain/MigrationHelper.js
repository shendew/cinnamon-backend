import { KeyManager } from './KeyManager.js';
import { TransactionSigner } from './CryptoUtils.js';


// for blockchain migrations and key management tasks
export class MigrationHelper {
    
    static async createSignedTransaction(txData) {
        const { actorUserId, ...rest } = txData;
        
        // check if user has keys
        const hasKeys = await KeyManager.hasKeys(actorUserId);
        if (!hasKeys) {
            throw new Error(`User ${actorUserId} does not have cryptographic keys. Generate keys first.`);
        }
        
        // get user keys
        const privateKey = await KeyManager.getPrivateKey(actorUserId);
        const publicKey = await KeyManager.getPublicKey(actorUserId);
        
        // create signed transaction
        return await TransactionSigner.createSignedTransaction({
            ...rest,
            actorUserId,
            privateKey,
            publicKey
        });
    }
    
    static async batchGenerateKeys(userIds) {
        const results = {
            success: [],
            failed: [],
            keys: {}
        };
        
        for (const userId of userIds) {
            try {
                const keys = await KeyManager.generateKeysForUser(userId);
                results.success.push(userId);
                results.keys[userId] = {
                    publicKey: keys.publicKey,
                    privateKey: keys.privateKey
                };
            } catch (error) {
                results.failed.push({
                    userId,
                    error: error.message
                });
            }
        }
        
        return results;
    }
    

    static async auditUserKeys(userIds) {
        const report = {
            withKeys: [],
            withoutKeys: [],
            inactive: []
        };
        
        for (const userId of userIds) {
            const hasKeys = await KeyManager.hasKeys(userId);
            const keyInfo = await KeyManager.getKeyInfo(userId);
            
            if (!keyInfo) {
                report.withoutKeys.push(userId);
            } else if (!keyInfo.isActive) {
                report.inactive.push(userId);
            } else {
                report.withKeys.push(userId);
            }
        }
        
        return report;
    }

    static async exportKeysForBackup(userId) {
        console.warn('[BC] Exporting private key');
        
        const privateKey = await KeyManager.getPrivateKey(userId);
        const publicKey = await KeyManager.getPublicKey(userId);
        const keyInfo = await KeyManager.getKeyInfo(userId);
        
        return {
            userId,
            publicKey,
            privateKey,
            keyVersion: keyInfo?.keyVersion,
            exportedAt: new Date().toISOString(),
            warning: 'STORE THIS SECURELY - NEVER SHARE OR EXPOSE!'
        };
    }
    
    static async testUserKeys(userId) {
        try {
            const hasKeys = await KeyManager.hasKeys(userId);
            if (!hasKeys) {
                return {
                    success: false,
                    error: 'User does not have keys'
                };
            }
            
            const privateKey = await KeyManager.getPrivateKey(userId);
            const publicKey = await KeyManager.getPublicKey(userId);
            
            // validate key pair
            const isValid = KeyManager.validateKeyPair(privateKey, publicKey);
            if (!isValid) {
                return {
                    success: false,
                    error: 'Key pair validation failed'
                };
            }
            
            // test transaction creation
            const testTx = await TransactionSigner.createSignedTransaction({
                transactionType: 'TEST',
                batchNo: 'TEST_BATCH',
                actorUserId: userId,
                actorRole: 'test',
                privateKey,
                publicKey,
                transactionData: { test: true }
            });
            
            return {
                success: true,
                message: 'User keys are working correctly',
                testTransaction: {
                    hash: testTx.hash || 'N/A',
                    signature: testTx.actorSignature ? 'Present' : 'Missing'
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}
