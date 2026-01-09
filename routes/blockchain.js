import express from "express";
import { protect } from "../middleware/auth.js";
import { completeBlockchainHistory, validateBlockchainIntegrity, getBlockchainStatics, getAllBlocks, getAllTransactions, getBlockByNumber, getTransactionByHash, checkBlockchainHealth, manualIntegrityCheck, generateKeysForUser, getUsersPublicKey, getKeyInformation, deactivateUserKeys, reactivateUserKeys, getValidatorInfo, clearRateLimits, reloadChain, resetBlockchain } from "../controllers/blockController.js";

const router = express.Router();



// get complete blockchain history for a batch
router.get("/verify/:batchNo", completeBlockchainHistory);

// Validate entire blockchain integrity ( admin refs )
router.get("/validate", protect, validateBlockchainIntegrity);

// Get blockchain statistics
router.get("/stats", protect, getBlockchainStatics);

// Get all blocks in the blockchain
router.get("/blocks", protect, getAllBlocks);

// Get all transactions across all blocks
router.get("/transactions", protect, getAllTransactions);

// Get block by number
router.get("/block/:blockNumber", protect, getBlockByNumber);

// Get transaction by hash
router.get("/transaction/:hash", protect, getTransactionByHash);

// Get blockchain health status
router.get("/health", protect, checkBlockchainHealth);

// Trigger manual integrity check
router.post("/integrity-check", protect, manualIntegrityCheck);

// Generate keys for current user
router.post("/keys/generate", protect, generateKeysForUser);

// Get user public key
router.get("/keys/public", protect, getUsersPublicKey);

// Get key information (without private key)
router.get("/keys/info", protect, getKeyInformation);

// Deactivate user keys (security measure)
router.post("/keys/deactivate", protect, deactivateUserKeys);

// Reactivate user keys
router.post("/keys/reactivate", protect, reactivateUserKeys);

// Get validator info
router.get("/validator/:userId", protect, getValidatorInfo);

// Clear rate limits - for admins
router.post("/admin/clear-rate-limits", protect, clearRateLimits);

// Reload blockchain from database
router.post("/admin/reload", protect, reloadChain);

// Reset blockchain (clear all and reinitialize)
router.post("/admin/reset", protect, resetBlockchain);

export default router;
