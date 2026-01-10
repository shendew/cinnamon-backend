import { db } from '../config/db.js';
import { user } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt.js';

/**
 * Helper function to sanitize user object (remove sensitive data)
 */
const sanitizeUser = (userInstance) => {
    const { password_hash, ...userWithoutPassword } = userInstance;
    return userWithoutPassword;
};

export const registerAdmin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    const { name, email, password, phone } = req.body;

    try {
        const userExists = await db.select().from(user).where(eq(user.email, email));
        if (userExists.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newAdmin = await db.insert(user).values({
            name,
            email,
            password_hash,
            phone,
            role_id: 0, // admin role
            status: 'active'
        }).returning();

        const sanitizedUser = sanitizeUser(newAdmin[0]);
        
        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            user: sanitizedUser,
            token: generateToken(newAdmin[0].user_id),
        });
    } catch (error) {
        console.error("Error registering admin:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to register admin", 
            error: error.message 
        });
    }
};


export const loginUser = async (req, res) => {
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
        console.error("Error logging in user:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to login user", 
            error: error.message 
        });
    }
};

export const getUserProfile = async (req, res) => {
    try {
        const users = await db.select().from(user).where(eq(user.user_id, req.user.user_id));
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        
        const sanitizedUser = sanitizeUser(users[0]);
        res.json({
            success: true,
            user: sanitizedUser
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch user profile", 
            error: error.message 
        });
    }
};

export const updateUserProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
        const { name, email, phone } = req.body;

        // Check if email is being changed and if it already exists
        if (email && email !== req.user.email) {
            const emailExists = await db.select().from(user).where(eq(user.email, email));
            if (emailExists.length > 0) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Email already exists' 
                });
            }
        }

        const updatedUser = await db.update(user)
            .set({ name, email, phone, updated_at: new Date().toISOString() })
            .where(eq(user.user_id, req.user.user_id))
            .returning();

        if (!updatedUser || updatedUser.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        const sanitizedUser = sanitizeUser(updatedUser[0]);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: sanitizedUser
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to update user profile", 
            error: error.message 
        });
    }
};
