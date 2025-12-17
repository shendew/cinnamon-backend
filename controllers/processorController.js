import { db } from '../config/db.js';
import { user, processor_profile } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt.js';

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