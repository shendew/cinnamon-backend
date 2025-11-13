import { db } from '../config/db.js';
import { user, farmer_profile } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { generateToken } from '../utils/jwt.js';


const sanitizeUser = (userInstance) => {
    const { password_hash, ...userWithoutPassword } = userInstance;
    return userWithoutPassword;
};

export const registerFarmer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    const { name, email, password, phone, nic, address, gender, date_of_birth } = req.body;

    try {
        await db.transaction(async (tx) => {
            const userExists = await tx.select().from(user).where(eq(user.email, email));
            if (userExists.length > 0) {
                return res.status(400).json({ 
                    success: false,
                    message: 'User already exists' 
                });
            }

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            const newUser = await tx.insert(user).values({
                name,
                email,
                password_hash,
                phone,
                role_id: 1, // farmer role
                status: 'active'
            }).returning();

            await tx.insert(farmer_profile).values({
                user_id: newUser[0].user_id,
                nic,
                address,
                gender,
                date_of_birth
            });

            const sanitizedUser = sanitizeUser(newUser[0]);
            
            res.status(201).json({
                success: true,
                message: 'Farmer registered successfully',
                user: sanitizedUser,
                token: generateToken(newUser[0].user_id)
            });
        });
    } catch (error) {
        console.error("Error registering farmer:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to register farmer", 
            error: error.message 
        });
    }
};

export const loginFarmer = async (req, res) => {
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

        if (userInstance.role_id !== 1) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized as a farmer' 
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
        console.error("Error logging in farmer:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to login farmer", 
            error: error.message 
        });
    }
};
