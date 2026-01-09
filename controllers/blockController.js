import { blockchainService, KeyManager } from "../blockchain/BlockchainService.js";


export const completeBlockchainHistory = async (req, res) => {
    try {
        const { batchNo } = req.params;
    
        const history = await blockchainService.getBatchHistory(batchNo);
    
        if (!history || history.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No blockchain records found for this batch"
            });
        }

        // Get batch blockchain reference
        const batchRef = await blockchainService.getBatchBlockchainReference(batchNo);
    
        res.json({
            success: true,
            batchNo,
            totalTransactions: history.length,
            blockchainVerified: true,
            firstRecordedAt: history[0].timestamp,
            lastUpdatedAt: history[history.length - 1].timestamp,
            currentStage: batchRef?.currentStage || "UNKNOWN",
            stages: batchRef?.stages || [],
            history: history.map(tx => ({
                transactionType: tx.transactionType,
                actorRole: tx.actorRole,
                actorUserId: tx.actorUserId,
                transactionData: tx.transactionData,
                documentHashes: tx.documentHashes,
                timestamp: tx.timestamp,
                blockNumber: tx.blockNumber,
                blockHash: tx.blockHash,
                blockTimestamp: tx.blockTimestamp,
                transactionHash: tx.transactionHash,
                isVerified: tx.isVerified
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving blockchain history",
            error: error.message
        });
    }
}


export const validateBlockchainIntegrity = async (req, res) => {
    try {
        const isValid = await blockchainService.validateChain();
    
        const stats = await blockchainService.getBlockchainStats();
    
        res.json({
            success: true,
            isValid,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error validating blockchain",
            error: error.message
        });
    }
}


export const getBlockchainStatics = async (req, res) => {
    try {
        const stats = await blockchainService.getBlockchainStats();
    
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving blockchain statistics",
            error: error.message
        });
    }
}

export const getAllBlocks = async (req, res) => {
    try {
        const blocks = await blockchainService.getAllBlocks();
        
        res.json({
            success: true,
            totalBlocks: blocks.length,
            blocks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving all blocks",
            error: error.message
        });
    }
}


export const getAllTransactions = async (req, res) => {
    try {
        const transactions = await blockchainService.getAllTransactions();
        
        res.json({
            success: true,
            totalTransactions: transactions.length,
            transactions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving all transactions",
            error: error.message
        });
    }
}

export const getBlockByNumber = async (req, res) => {
    try {
        const blockNumber = parseInt(req.params.blockNumber);
        
        if (isNaN(blockNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid block number"
            });
        }
        
        const block = await blockchainService.getBlockByNumber(blockNumber);
        
        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }
        
        res.json({
            success: true,
            block
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving block",
            error: error.message
        });
    }
}


export const getTransactionByHash = async (req, res) => {
    try {
        const { hash } = req.params;
        
        const transaction = await blockchainService.getTransactionByHash(hash);
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }
        
        res.json({
            success: true,
            transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving transaction",
            error: error.message
        });
    }
}

export const checkBlockchainHealth = async (req, res) => {
    try {
        const health = blockchainService.getHealthStatus();
        
        res.json({
            success: true,
            health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving health status",
            error: error.message
        });
    }
}


export const manualIntegrityCheck = async (req, res) => {
    try {
        const result = await blockchainService.performIntegrityCheck();
        
        res.json({
            success: true,
            integrityCheck: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error performing integrity check",
            error: error.message
        });
    }
}

export const generateKeysForUser = async (req, res) => {
    try {
        const userId = req.user.user_id; // From auth middleware
        
        const keys = await KeyManager.generateKeysForUser(userId);
        
        res.json({
            success: true,
            message: "Keys generated successfully. SAVE YOUR PRIVATE KEY SECURELY!",
            publicKey: keys.publicKey,
            privateKey: keys.privateKey, // Only returned once!
            keyVersion: keys.keyVersion,
            warning: "This is the only time you will see your private key. Store it securely!"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error generating keys",
            error: error.message
        });
    }
}

export const getUsersPublicKey = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const publicKey = await KeyManager.getPublicKey(userId);
        
        if (!publicKey) {
        return res.status(404).json({
            success: false,
            message: "No keys found. Generate keys first."
        });
        }
        
        res.json({
            success: true,
            publicKey
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving public key",
            error: error.message
        });
    }
}


export const getKeyInformation = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const keyInfo = await KeyManager.getKeyInfo(userId);
        
        if (!keyInfo) {
        return res.status(404).json({
            success: false,
            message: "No keys found"
        });
        }
        
        res.json({
            success: true,
            keyInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving key info",
            error: error.message
        });
    }
}


export const deactivateUserKeys = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const success = await KeyManager.deactivateKeys(userId);
        
        res.json({
            success,
            message: success ? "Keys deactivated successfully" : "Failed to deactivate keys"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deactivating keys",
            error: error.message
        });
    }
}


export const reactivateUserKeys = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const success = await KeyManager.reactivateKeys(userId);
        
        res.json({
            success,
            message: success ? "Keys reactivated successfully" : "Failed to reactivate keys"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error reactivating keys",
            error: error.message
        });
    }
}


export const getValidatorInfo = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        const validatorInfo = await blockchainService.getValidatorInfo(userId);
        
        res.json({
            success: true,
            validatorInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving validator info",
            error: error.message
        });
    }
}


export const clearRateLimits = async (req, res) => {
    try {
        blockchainService.clearRateLimits();
        
        res.json({
            success: true,
            message: "Rate limits cleared"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error clearing rate limits",
            error: error.message
        });
    }
}

export const reloadChain = async (req, res) => {
    try {
        const result = await blockchainService.reloadChain();
        
        res.json({
            success: result.success,
            message: result.success ? "Blockchain reloaded successfully" : "Failed to reload blockchain",
            blockCount: result.blockCount,
            isValid: result.isValid,
            error: result.error
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error reloading blockchain",
            error: error.message
        });
    }
}

export const resetBlockchain = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production' && !req.user?.is_admin) {
            return res.status(403).json({
                success: false,
                message: "Reset is only allowed for administrators in production"
            });
        }

        const result = await blockchainService.resetBlockchain();
        
        res.json({
            success: result.success,
            message: result.success ? "Blockchain reset and reinitialized" : "Failed to reset blockchain",
            blockCount: result.blockCount,
            error: result.error
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error resetting blockchain",
            error: error.message
        });
    }
}