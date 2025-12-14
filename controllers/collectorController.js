import { db } from '../config/db.js';
import { user, collector_profile, main, collect_table, transport } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt.js';

const sanitizeUser = (userInstance) => {
    const { password_hash, ...userWithoutPassword } = userInstance;
    return userWithoutPassword;
};

export const registerCollector = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    const { name, email, password, phone, center_name, vehicle_id, location } = req.body;

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
                role_id: 2, // collector role
                status: 'active'
            }).returning();

            await tx.insert(collector_profile).values({
                user_id: newUser[0].user_id,
                center_name,
                vehicle_id,
                location
            });

            return newUser[0];
        });

        const sanitizedUser = sanitizeUser(result);
        
        res.status(201).json({
            success: true,
            message: 'Collector registered successfully',
            user: sanitizedUser,
            token: generateToken(result.user_id)
        });
    } catch (error) {
        console.error("Error registering collector:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to register collector", 
            error: error.message 
        });
    }
};

export const loginCollector = async (req, res) => {
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

        if (userInstance.role_id !== 2) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized as a collector' 
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
        console.error("Error logging in collector:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to login collector", 
            error: error.message 
        });
    }
};

export const getCollectorProfile = async (req, res) => {
    try {
        // Verify user is a collector
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 2) {
            return res.status(403).json({ 
                success: false,
                message: 'Only collectors can access collector profile' 
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

        // Get collector profile information
        const collectorProfiles = await db.select()
            .from(collector_profile)
            .where(eq(collector_profile.user_id, req.user.user_id));

        if (collectorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Collector profile not found' 
            });
        }

        // Combine user and collector profile data
        const userData = sanitizeUser(users[0]);
        const collectorData = collectorProfiles[0];

        res.json({
            success: true,
            profile: {
                ...userData,
                collector_profile: {
                    collector_id: collectorData.collector_id,
                    center_name: collectorData.center_name,
                    vehicle_id: collectorData.vehicle_id,
                    location: collectorData.location,
                    created_at: collectorData.created_at,
                    updated_at: collectorData.updated_at
                }
            }
        });
    } catch (error) {
        console.error("Error fetching collector profile:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch collector profile", 
            error: error.message 
        });
    }
};

export const collectBatch = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a collector
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 2) {
            return res.status(403).json({ 
                success: false,
                message: 'Only collectors can collect batches' 
            });
        }

        // Get collector_id from collector_profile using user_id
        const collectorProfiles = await db.select()
            .from(collector_profile)
            .where(eq(collector_profile.user_id, req.user.user_id));

        if (collectorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Collector profile not found' 
            });
        }

        const collectorId = collectorProfiles[0].collector_id;
        const { batch_no, collected_date } = req.body;

        // Verify that the batch exists and is harvested
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

        // Check if batch is harvested
        if (!batch.is_harvested) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be harvested before collection' 
            });
        }

        // Check if batch is already collected
        if (batch.is_collected) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been collected' 
            });
        }

        // Create collection record in a transaction
        const result = await db.transaction(async (tx) => {
            // Step 1: Create collect_table record
            const newCollection = await tx.insert(collect_table).values({
                batch_no: batch_no,
                collector_id: collectorId,
                collected_date: collected_date
            }).returning();

            // Step 2: Update main table with collect_id and is_collected=true
            await tx.update(main)
                .set({ 
                    collect_id: newCollection[0].collect_id,
                    is_collected: true,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return newCollection[0];
        });

        res.status(201).json({
            success: true,
            message: 'Batch collected successfully',
            collection: result,
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error collecting batch:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to collect batch", 
            error: error.message 
        });
    }
};

export const startTransport = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a collector
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 2) {
            return res.status(403).json({ 
                success: false,
                message: 'Only collectors can start transport' 
            });
        }

        // Get collector_id from collector_profile using user_id
        const collectorProfiles = await db.select()
            .from(collector_profile)
            .where(eq(collector_profile.user_id, req.user.user_id));

        if (collectorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Collector profile not found' 
            });
        }

        const collectorId = collectorProfiles[0].collector_id;
        const { batch_no, transport_method, transport_started_date, storage_conditions } = req.body;

        // Verify that the batch exists, is harvested, and is collected
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

        // Check if batch is harvested
        if (!batch.is_harvested) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be harvested before transport' 
            });
        }

        // Check if batch is collected
        if (!batch.is_collected) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be collected before transport' 
            });
        }

        // Check if batch is already in transport
        if (batch.inTransporting) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch is already in transport' 
            });
        }

        // Check if batch is already transported
        if (batch.isTransported) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been transported' 
            });
        }

        // Create transport record in a transaction
        const result = await db.transaction(async (tx) => {
            // Step 1: Create transport record
            const newTransport = await tx.insert(transport).values({
                batch_no: batch_no,
                collector_id: collectorId,
                transport_method: transport_method,
                transport_started_date: transport_started_date,
                storage_conditions: storage_conditions
            }).returning();

            // Step 2: Update main table with transport_id and inTransporting=true
            await tx.update(main)
                .set({ 
                    transport_id: newTransport[0].transport_id,
                    inTransporting: true,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return newTransport[0];
        });

        res.status(201).json({
            success: true,
            message: 'Transport started successfully',
            transport: result,
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error starting transport:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to start transport", 
            error: error.message 
        });
    }
};

export const completeTransport = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a collector
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 2) {
            return res.status(403).json({ 
                success: false,
                message: 'Only collectors can complete transport' 
            });
        }

        // Get collector_id from collector_profile using user_id
        const collectorProfiles = await db.select()
            .from(collector_profile)
            .where(eq(collector_profile.user_id, req.user.user_id));

        if (collectorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Collector profile not found' 
            });
        }

        const collectorId = collectorProfiles[0].collector_id;
        const { batch_no, transport_ended_date } = req.body;

        // Verify that the batch exists and is in transport
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

        // Check if batch is in transport
        if (!batch.inTransporting) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch is not in transport' 
            });
        }

        // Check if batch is already transported
        if (batch.isTransported) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been transported' 
            });
        }

        // Verify that the transport belongs to this collector
        if (!batch.transport_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Transport record not found for this batch' 
            });
        }

        const transportRecords = await db.select()
            .from(transport)
            .where(and(
                eq(transport.transport_id, batch.transport_id),
                eq(transport.collector_id, collectorId)
            ));

        if (transportRecords.length === 0) {
            return res.status(403).json({ 
                success: false,
                message: 'You do not have permission to complete this transport' 
            });
        }

        // Complete transport in a transaction
        const result = await db.transaction(async (tx) => {
            // Step 1: Update transport record with transport_ended_date
            const updatedTransport = await tx.update(transport)
                .set({ 
                    transport_ended_date: transport_ended_date,
                    updated_at: sql`NOW()`
                })
                .where(eq(transport.transport_id, batch.transport_id))
                .returning();

            // Step 2: Update main table with isTransported=true and inTransporting=false
            await tx.update(main)
                .set({ 
                    isTransported: true,
                    inTransporting: false,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return updatedTransport[0];
        });

        res.json({
            success: true,
            message: 'Transport completed successfully',
            transport: result,
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error completing transport:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to complete transport", 
            error: error.message 
        });
    }
};

