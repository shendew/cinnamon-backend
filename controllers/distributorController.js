import { db } from '../config/db.js';
import { user, distributor_profile, main, distribute_table } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt.js';
import { BlockchainHelper } from '../blockchain/BlockchainHelper.js';

const sanitizeUser = (userInstance) => {
    const { password_hash, ...userWithoutPassword } = userInstance;
    return userWithoutPassword;
};

export const registerDistributor = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    const { name, email, password, phone } = req.body;

    try {
        // Check if user already exists before starting transaction
        const userExists = await db.select().from(user).where(eq(user.email, email));
        if (userExists.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }

        const result = await db.transaction(async (tx) => {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            const newUser = await tx.insert(user).values({
                name,
                email,
                password_hash,
                phone,
                role_id: 4, // distributor role
                status: 'active'
            }).returning();

            await tx.insert(distributor_profile).values({
                user_id: newUser[0].user_id
            });

            return newUser[0];
        });

        const sanitizedUser = sanitizeUser(result);
        
        res.status(201).json({
            success: true,
            message: 'Distributor registered successfully',
            user: sanitizedUser,
            token: generateToken(result.user_id)
        });
    } catch (error) {
        console.error("Error registering distributor:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to register distributor", 
            error: error.message 
        });
    }
};

export const loginDistributor = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    const { email, password } = req.body;

    try {
        const users = await db.select().from(user).where(eq(user.email, email));
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        const userInstance = users[0];

        if (userInstance.role_id !== 4) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized as a distributor' 
            });
        }

        const isMatch = await bcrypt.compare(password, userInstance.password_hash);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        const sanitizedUser = sanitizeUser(userInstance);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: sanitizedUser,
            token: generateToken(userInstance.user_id),
        });
    } catch (error) {
        console.error("Error logging in distributor:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to login distributor", 
            error: error.message 
        });
    }
};

export const getDistributorProfile = async (req, res) => {
    try {
        // Verify user is a distributor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 4) {
            return res.status(403).json({ 
                success: false,
                message: 'Only distributors can access distributor profile' 
            });
        }

        // Get user information
        const users = await db.select()
            .from(user)
            .where(eq(user.user_id, req.user.user_id));

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Get distributor profile information
        const distributorProfiles = await db.select()
            .from(distributor_profile)
            .where(eq(distributor_profile.user_id, req.user.user_id));

        if (distributorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Distributor profile not found' 
            });
        }

        // Combine user and distributor profile data
        const userData = sanitizeUser(users[0]);
        const distributorData = distributorProfiles[0];

        res.json({
            success: true,
            profile: {
                ...userData,
                distributor_profile: {
                    distributor_id: distributorData.distributor_id,
                    created_at: distributorData.created_at,
                    updated_at: distributorData.updated_at
                }
            }
        });
    } catch (error) {
        console.error("Error fetching distributor profile:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch distributor profile", 
            error: error.message 
        });
    }
};

// Get available processed batches
export const getAvailableBatches = async (req, res) => {
    try {
        // Verify user is a distributor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 4) {
            return res.status(403).json({ 
                success: false,
                message: 'Only distributors can view available batches' 
            });
        }

        // Get batches that are processed but not yet collected by distributor
        const availableBatches = await db.select()
            .from(main)
            .where(and(
                eq(main.isProcessed, true),
                eq(main.collected_by_distributor, false)
            ));

        res.json({
            success: true,
            batches: availableBatches
        });
    } catch (error) {
        console.error("Error fetching available batches:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch available batches", 
            error: error.message 
        });
    }
};

// Mark as collected by distributor
export const markAsCollectedByDistributor = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a distributor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 4) {
            return res.status(403).json({ 
                success: false,
                message: 'Only distributors can collect batches' 
            });
        }

        // Get distributor_id from distributor_profile using user_id
        const distributorProfiles = await db.select()
            .from(distributor_profile)
            .where(eq(distributor_profile.user_id, req.user.user_id));

        if (distributorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Distributor profile not found' 
            });
        }

        const distributorId = distributorProfiles[0].distributor_id;
        const { batch_no, collected_date } = req.body;

        // Verify that the batch exists and is processed
        const batchRecords = await db.select()
            .from(main)
            .where(eq(main.batch_no, batch_no));

        if (batchRecords.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Batch not found' 
            });
        }

        const batch = batchRecords[0];

        // Check if batch is processed
        if (!batch.isProcessed) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be processed before collection by distributor' 
            });
        }

        // Check if batch is already collected by distributor
        if (batch.collected_by_distributor) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been collected by distributor' 
            });
        }

        const result = await db.transaction(async (tx) => {
            // create distribute_table record
            const newDistribute = await tx.insert(distribute_table).values({
                batch_no: batch_no,
                distributor_id: distributorId,
                collected_date: collected_date
            }).returning();

            // update main table
            await tx.update(main)
                .set({ 
                    collected_by_distributor: true,
                    distribute_id: newDistribute[0].distribute_id,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return newDistribute[0];
        });

        // create distribution collection on blockchain
        const blockchainResult = await BlockchainHelper.recordDistributionCollect(
            {
                collected_date: collected_date,
                distribute_id: result.distribute_id
            },
            batch_no,
            req.user.user_id,
            distributorId,
            batch.processor_id
        );

        res.status(201).json({
            success: true,
            message: 'Batch marked as collected by distributor successfully',
            distribution: result,
            batch_no: batch_no,
            blockchain: blockchainResult
        });
    } catch (error) {
        console.error("Error marking batch as collected by distributor:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as collected by distributor", 
            error: error.message 
        });
    }
};

// Mark as distributed
export const markAsDistributed = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a distributor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 4) {
            return res.status(403).json({ 
                success: false,
                message: 'Only distributors can mark batches as distributed' 
            });
        }

        // Get distributor_id from distributor_profile using user_id
        const distributorProfiles = await db.select()
            .from(distributor_profile)
            .where(eq(distributor_profile.user_id, req.user.user_id));

        if (distributorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Distributor profile not found' 
            });
        }

        const distributorId = distributorProfiles[0].distributor_id;
        const { batch_no, distributed_date } = req.body;

        // Verify that the batch exists and is collected by distributor
        const batchRecords = await db.select()
            .from(main)
            .where(eq(main.batch_no, batch_no));

        if (batchRecords.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Batch not found' 
            });
        }

        const batch = batchRecords[0];

        // Check if batch is collected by distributor
        if (!batch.collected_by_distributor) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be collected by distributor before marking as distributed' 
            });
        }

        // Check if batch is already distributed
        if (batch.is_distributed) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been marked as distributed' 
            });
        }

        // Verify that the distribute record belongs to this distributor
        if (!batch.distribute_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Distribution record not found for this batch' 
            });
        }

        const distributeRecords = await db.select()
            .from(distribute_table)
            .where(and(
                eq(distribute_table.distribute_id, batch.distribute_id),
                eq(distribute_table.distributor_id, distributorId)
            ));

        if (distributeRecords.length === 0) {
            return res.status(403).json({ 
                success: false,
                message: 'You do not have permission to distribute this batch' 
            });
        }

        const result = await db.transaction(async (tx) => {
            // update distribute_table with the date
            const updatedDistribute = await tx.update(distribute_table)
                .set({ 
                    distributed_date: distributed_date,
                    updated_at: sql`NOW()`
                })
                .where(eq(distribute_table.distribute_id, batch.distribute_id))
                .returning();

            // update main table
            await tx.update(main)
                .set({ 
                    is_distributed: true,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return updatedDistribute[0];
        });

        // create distribution completion on blockchain
        const blockchainResult = await BlockchainHelper.recordDistributionComplete(
            {
                distributed_date: distributed_date,
                distribute_id: batch.distribute_id
            },
            batch_no,
            req.user.user_id,
            distributorId
        );

        res.json({
            success: true,
            message: 'Batch marked as distributed successfully',
            distribution: result,
            batch_no: batch_no,
            blockchain: blockchainResult
        });
    } catch (error) {
        console.error("Error marking batch as distributed:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as distributed", 
            error: error.message 
        });
    }
};

