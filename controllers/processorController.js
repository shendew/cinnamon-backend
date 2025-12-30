import { db } from '../config/db.js';
import { user, processor_profile, main, process, grader_profile, farms, farmer_profile, cultivation, harvest, collect_table, collector_profile, transport } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt.js';
import { uploadToGoogleDrive } from '../utils/googleDrive.js';

const sanitizeUser = (userInstance) => {
    const { password_hash, ...userWithoutPassword } = userInstance;
    return userWithoutPassword;
};

export const registerProcessor = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    const { name, email, password, phone, process_station_name, process_station_location } = req.body;

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
                role_id: 3, // processor role
                status: 'active'
            }).returning();

            await tx.insert(processor_profile).values({
                user_id: newUser[0].user_id,
                process_station_name,
                process_station_location
            });

            return newUser[0];
        });

        const sanitizedUser = sanitizeUser(result);
        
        res.status(201).json({
            success: true,
            message: 'Processor registered successfully',
            user: sanitizedUser,
            token: generateToken(result.user_id)
        });
    } catch (error) {
        console.error("Error registering processor:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to register processor", 
            error: error.message 
        });
    }
};

export const loginProcessor = async (req, res) => {
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

        if (userInstance.role_id !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized as a processor' 
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
        console.error("Error logging in processor:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to login processor", 
            error: error.message 
        });
    }
};

export const getProcessorProfile = async (req, res) => {
    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can access processor profile' 
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

        // Get processor profile information
        const processorProfiles = await db.select()
            .from(processor_profile)
            .where(eq(processor_profile.user_id, req.user.user_id));

        if (processorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Processor profile not found' 
            });
        }

        // Combine user and processor profile data
        const userData = sanitizeUser(users[0]);
        const processorData = processorProfiles[0];

        res.json({
            success: true,
            profile: {
                ...userData,
                processor_profile: {
                    processor_id: processorData.processor_id,
                    process_station_name: processorData.process_station_name,
                    process_station_location: processorData.process_station_location,
                    created_at: processorData.created_at,
                    updated_at: processorData.updated_at
                }
            }
        });
    } catch (error) {
        console.error("Error fetching processor profile:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch processor profile", 
            error: error.message 
        });
    }
};

// Create grader profile (only processors can create)
export const createGraderProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can create grader profiles' 
            });
        }

        const { grader_name, grader_contact } = req.body;

        // Create grader profile
        const newGrader = await db.insert(grader_profile).values({
            grader_name,
            grader_contact
        }).returning();

        res.status(201).json({
            success: true,
            message: 'Grader profile created successfully',
            grader: newGrader[0]
        });
    } catch (error) {
        console.error("Error creating grader profile:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to create grader profile", 
            error: error.message 
        });
    }
};

// Get all grader profiles
export const getGraders = async (req, res) => {
    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can view grader profiles' 
            });
        }

        const graders = await db.select()
            .from(grader_profile);

        res.json({
            success: true,
            graders: graders
        });
    } catch (error) {
        console.error("Error fetching graders:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch grader profiles", 
            error: error.message 
        });
    }
};

// Get available transported batches
export const getAvailableBatches = async (req, res) => {
    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can view available batches' 
            });
        }

        // Get batches that are transported but not yet in process
        const availableBatches = await db.select()
            .from(main)
            .where(and(
                eq(main.isTransported, true),
                eq(main.inProcess, false)
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

// Mark as in process
export const markAsInProcess = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can mark batches as in process' 
            });
        }

        // Get processor_id from processor_profile using user_id
        const processorProfiles = await db.select()
            .from(processor_profile)
            .where(eq(processor_profile.user_id, req.user.user_id));

        if (processorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Processor profile not found' 
            });
        }

        const processorId = processorProfiles[0].processor_id;
        const { batch_no } = req.body;

        // Verify that the batch exists and is transported
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

        // Check if batch is transported
        if (!batch.isTransported) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be transported before processing' 
            });
        }

        // Check if batch is already in process
        if (batch.inProcess) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch is already in process' 
            });
        }

        // Create process record in a transaction
        const result = await db.transaction(async (tx) => {
            // Step 1: Create process record
            const newProcess = await tx.insert(process).values({
                batch_no: batch_no,
                processor_id: processorId
            }).returning();

            // Step 2: Update main table with inProcess=true and process_id
            await tx.update(main)
                .set({ 
                    inProcess: true,
                    process_id: newProcess[0].process_id,
                    processor_id: processorId,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return newProcess[0];
        });

        res.status(201).json({
            success: true,
            message: 'Batch marked as in process successfully',
            process: result,
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error marking batch as in process:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as in process", 
            error: error.message 
        });
    }
};

// Mark as dried
export const markAsDried = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can mark batches as dried' 
            });
        }

        const { batch_no, dry_started_date, dry_ended_date, moisture_content, dried_weight } = req.body;

        // Verify that the batch exists and is in process
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

        // Check if batch is in process
        if (!batch.inProcess) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be in process before marking as dried' 
            });
        }

        // Check if batch is already dried
        if (!batch.process_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Process record not found for this batch' 
            });
        }

        const processRecords = await db.select()
            .from(process)
            .where(eq(process.process_id, batch.process_id));

        if (processRecords.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Process record not found' 
            });
        }

        /* Allow update if already dried
        if (processRecords[0].isDried) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been marked as dried' 
            });
        }
        */

        // Update process and main tables in a transaction
        const result = await db.transaction(async (tx) => {
            // Step 1: Update process table
            const updatedProcess = await tx.update(process)
                .set({ 
                    isDried: true,
                    dry_started_date: dry_started_date,
                    dry_ended_date: dry_ended_date,
                    moisture_content: parseFloat(moisture_content),
                    dried_weight: parseFloat(dried_weight),
                    updated_at: sql`NOW()`
                })
                .where(eq(process.process_id, batch.process_id))
                .returning();

            // Step 2: Update main table with dried_weight
            await tx.update(main)
                .set({ 
                    dried_weight: parseFloat(dried_weight),
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return updatedProcess[0];
        });

        res.json({
            success: true,
            message: 'Batch marked as dried successfully',
            process: result,
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error marking batch as dried:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as dried", 
            error: error.message 
        });
    }
};

// Mark as graded
export const markAsGraded = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can mark batches as graded' 
            });
        }

        const { batch_no, graded_date, grader_id, grader_sign } = req.body;

        // Upload grader signature file to Google Drive if provided
        let graderSignLink = null;
        
        if (req.file) {
            try {
                // Create unique filename using batch_no and grader_id (if provided)
                const graderIdPart = grader_id ? `-grader${grader_id}` : '';
                const customFileName = `grader-sign-${batch_no}${graderIdPart}`;
                const driveFileData = await uploadToGoogleDrive(req.file, 'Grader Signs', customFileName);
                graderSignLink = driveFileData.webViewLink;
            } catch (uploadError) {
                console.error('Error uploading grader signature to Google Drive:', uploadError);
                return res.status(500).json({ 
                    success: false,
                    message: 'Failed to upload grader signature document to Google Drive',
                    error: uploadError.message
                });
            }
        } else {
             // Fallback to text provided or default
             graderSignLink = grader_sign || 'Signature pending/Not provided';
        }

        // Verify that the batch exists and is in process
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

        // Check if batch is in process
        if (!batch.inProcess) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be in process before grading' 
            });
        }

        // Check if batch is dried
        if (!batch.process_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Process record not found for this batch' 
            });
        }

        const processRecords = await db.select()
            .from(process)
            .where(eq(process.process_id, batch.process_id));

        if (processRecords.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Process record not found' 
            });
        }

        if (!processRecords[0].isDried) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be dried before grading' 
            });
        }

        /* Allow update if already graded
        if (processRecords[0].isGraded) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been marked as graded' 
            });
        }
        */

        // If grader_id is provided, verify it exists
        if (grader_id) {
            const graderRecords = await db.select()
                .from(grader_profile)
                .where(eq(grader_profile.grader_id, parseInt(grader_id)));

            if (graderRecords.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Grader profile not found' 
                });
            }
        }

        // Update process table
        const result = await db.update(process)
            .set({ 
                isGraded: true,
                graded_date: graded_date,
                grader_id: grader_id ? parseInt(grader_id) : null,
                grader_sign: graderSignLink, // Store Google Drive link
                updated_at: sql`NOW()`
            })
            .where(eq(process.process_id, batch.process_id))
            .returning();

        res.json({
            success: true,
            message: 'Batch marked as graded successfully',
            process: result[0],
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error marking batch as graded:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as graded", 
            error: error.message 
        });
    }
};

// Mark as packed
export const markAsPacked = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can mark batches as packed' 
            });
        }

        const { batch_no, packed_date, packed_by, packing_type, package_weight } = req.body;

        // Verify that the batch exists and is in process
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

        // Check if batch is in process
        if (!batch.inProcess) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be in process before packing' 
            });
        }

        // Check if batch is graded
        if (!batch.process_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Process record not found for this batch' 
            });
        }

        const processRecords = await db.select()
            .from(process)
            .where(eq(process.process_id, batch.process_id));

        if (processRecords.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Process record not found' 
            });
        }

        if (!processRecords[0].isGraded) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be graded before packing' 
            });
        }

        if (processRecords[0].isPacked) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been marked as packed' 
            });
        }

        // Update process table
        const result = await db.update(process)
            .set({ 
                isPacked: true,
                packed_date: packed_date,
                packed_by: packed_by,
                packing_type: packing_type,
                package_weight: parseFloat(package_weight),
                updated_at: sql`NOW()`
            })
            .where(eq(process.process_id, batch.process_id))
            .returning();

        res.json({
            success: true,
            message: 'Batch marked as packed successfully',
            process: result[0],
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error marking batch as packed:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as packed", 
            error: error.message 
        });
    }
};

// Mark as processed
export const markAsProcessed = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can mark batches as processed' 
            });
        }

        const { batch_no, processed_date } = req.body;

        // Verify that the batch exists and is in process
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

        // Check if batch is in process
        if (!batch.inProcess) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be in process before marking as processed' 
            });
        }

        // Check if batch is packed
        if (!batch.process_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Process record not found for this batch' 
            });
        }

        const processRecords = await db.select()
            .from(process)
            .where(eq(process.process_id, batch.process_id));

        if (processRecords.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Process record not found' 
            });
        }

        if (!processRecords[0].isPacked) {
            return res.status(400).json({ 
                success: false,
                message: 'Batch must be packed before marking as processed' 
            });
        }

        if (batch.isProcessed) {
            return res.status(400).json({ 
                success: false,
                message: 'This batch has already been marked as processed' 
            });
        }

        // Update process and main tables in a transaction
        const result = await db.transaction(async (tx) => {
            // Step 1: Update process table with processed_date
            const updatedProcess = await tx.update(process)
                .set({ 
                    processed_date: processed_date || new Date(),
                    updated_at: sql`NOW()`
                })
                .where(eq(process.process_id, batch.process_id))
                .returning();

            // Step 2: Update main table with isProcessed=true
            await tx.update(main)
                .set({ 
                    isProcessed: true,
                    updated_at: sql`NOW()`
                })
                .where(eq(main.batch_no, batch_no));

            return updatedProcess[0];
        });

        res.json({
            success: true,
            message: 'Batch marked as processed successfully',
            process: result,
            batch_no: batch_no
        });
    } catch (error) {
        console.error("Error marking batch as processed:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to mark batch as processed", 
            error: error.message 
        });
    }
};

// Get batches that are graded but not yet packed (ready for packaging)
export const getGradedBatches = async (req, res) => {
    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can view graded batches' 
            });
        }

        // Get processor_id from processor_profile using user_id
        const processorProfiles = await db.select()
            .from(processor_profile)
            .where(eq(processor_profile.user_id, req.user.user_id));

        if (processorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Processor profile not found' 
            });
        }

        const processorId = processorProfiles[0].processor_id;

        // Get batches that are:
        // 1. In process (inProcess = true)
        // 2. Have a process record where isGraded = true but isPacked = false
        const gradedBatches = await db.select({
            batch_no: main.batch_no,
            harvested_quantity: main.harvested_quantity,
            dried_weight: main.dried_weight,
            farm_id: main.farm_id,
            created_at: main.created_at,
            process_id: process.process_id,
            isDried: process.isDried,
            isGraded: process.isGraded,
            isPacked: process.isPacked,
            graded_date: process.graded_date
        })
        .from(main)
        .innerJoin(process, eq(main.process_id, process.process_id))
        .where(and(
            eq(main.inProcess, true),
            eq(main.processor_id, processorId),
            eq(process.isGraded, true),
            eq(process.isPacked, false)
        ));

        res.json({
            success: true,
            batches: gradedBatches
        });
    } catch (error) {
        console.error("Error fetching graded batches:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch graded batches", 
            error: error.message 
        });
    }
};

// Get all batches being processed by this processor with status
export const getMyProcessings = async (req, res) => {
    try {
        // Verify user is a processor
        const userRoleId = Number(req.user.role_id);
        
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ 
                success: false,
                message: 'Only processors can view their processings' 
            });
        }

        // Get processor_id from processor_profile using user_id
        const processorProfiles = await db.select()
            .from(processor_profile)
            .where(eq(processor_profile.user_id, req.user.user_id));

        if (processorProfiles.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Processor profile not found' 
            });
        }

        const processorId = processorProfiles[0].processor_id;

        // Get all batches in process by this processor
        const processings = await db.select({
            batch_no: main.batch_no,
            harvested_quantity: main.harvested_quantity,
            dried_weight: main.dried_weight,
            inProcess: main.inProcess,
            isProcessed: main.isProcessed,
            farm_id: main.farm_id,
            created_at: main.created_at,
            process_id: process.process_id,
            isDried: process.isDried,
            isGraded: process.isGraded,
            isPacked: process.isPacked,
            dry_started_date: process.dry_started_date,
            dry_ended_date: process.dry_ended_date,
            graded_date: process.graded_date,
            packed_date: process.packed_date,
            processed_date: process.processed_date
        })
        .from(main)
        .innerJoin(process, eq(main.process_id, process.process_id))
        .where(eq(main.processor_id, processorId));

        res.json({
            success: true,
            processings: processings
        });
    } catch (error) {
        console.error("Error fetching processings:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch processings", 
            error: error.message 
        });
    }
};

// Get full details of a specific processing batch (Chain View)
export const getProcessingDetails = async (req, res) => {
    try {
        const { batch_no } = req.params;

        // Verify processor access
        // (Similar checks as above or trust protect middleware + data access check)
        const userRoleId = Number(req.user.role_id);
        if (isNaN(userRoleId) || userRoleId !== 3) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // 1. Get Main Batch Info
        const batchRecords = await db.select().from(main).where(eq(main.batch_no, batch_no));
        if (batchRecords.length === 0) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }
        const batch = batchRecords[0];

        // 2. Farm Details
        let farmData = null;
        if (batch.farm_id) {
            const farmRecords = await db.select().from(farms).where(eq(farms.farm_id, batch.farm_id));
            if (farmRecords.length > 0) farmData = farmRecords[0];
        }

        // 3. Farmer Details
        let farmerData = null;
        if (batch.farmer_id) {
            const farmerRecords = await db.select({
                farmer_id: farmer_profile.farmer_id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                address: farmer_profile.address,
                nic: farmer_profile.nic
            })
            .from(farmer_profile)
            .leftJoin(user, eq(farmer_profile.user_id, user.user_id))
            .where(eq(farmer_profile.farmer_id, batch.farmer_id));
            if (farmerRecords.length > 0) farmerData = farmerRecords[0];
        }

        // 4. Cultivation Details
        let cultivationData = null;
        const cultivationRecords = await db.select().from(cultivation).where(eq(cultivation.batch_no, batch_no));
        if (cultivationRecords.length > 0) cultivationData = cultivationRecords[0];

        // 5. Harvest Details
        let harvestData = null;
        if (batch.harvest_id) {
            const harvestRecords = await db.select().from(harvest).where(eq(harvest.harvest_id, batch.harvest_id));
            if (harvestRecords.length > 0) harvestData = harvestRecords[0];
        }

        // 6. Collection Details & Collector
        let collectionData = null;
        let collectorData = null;
        if (batch.collect_id) {
            const collectRecords = await db.select().from(collect_table).where(eq(collect_table.collect_id, batch.collect_id));
            if (collectRecords.length > 0) {
                collectionData = collectRecords[0];
                
                // Fetch collector info if collection exists
                if (collectionData.collector_id) {
                    const collectorRecords = await db.select({
                        collector_id: collector_profile.collector_id,
                        name: user.name,
                        center_name: collector_profile.center_name,
                        location: collector_profile.location,
                        phone: user.phone
                    })
                    .from(collector_profile)
                    .leftJoin(user, eq(collector_profile.user_id, user.user_id))
                    .where(eq(collector_profile.collector_id, collectionData.collector_id));
                    if (collectorRecords.length > 0) collectorData = collectorRecords[0];
                }
            }
        }

        // 7. Transport Details
        let transportData = null;
        if (batch.transport_id) {
            const transportRecords = await db.select().from(transport).where(eq(transport.transport_id, batch.transport_id));
            if (transportRecords.length > 0) transportData = transportRecords[0];
        }

        // 8. Processing Details
        let processData = null;
        let graderData = null;

        if (batch.process_id) {
            const processRecords = await db.select().from(process).where(eq(process.process_id, batch.process_id));
            if (processRecords.length > 0) {
                processData = processRecords[0];

                if (processData.grader_id) {
                    const graderRecords = await db.select().from(grader_profile).where(eq(grader_profile.grader_id, processData.grader_id));
                    if (graderRecords.length > 0) graderData = graderRecords[0];
                }
            }
        }

        res.json({
            success: true,
            batch: batch,
            farm: farmData,
            farmer: farmerData,
            cultivation: cultivationData,
            harvest: harvestData,
            collection: collectionData,
            collector: collectorData,
            transport: transportData,
            process: processData,
            grader: graderData
        });

    } catch (error) {
        console.error("Error fetching processing details:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch details", 
            error: error.message 
        });
    }
};