
import { db } from '../config/db.js';
import { user, farmer_profile } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';

export const registerFarmer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, nic, address, gender, date_of_birth } = req.body;

    try {
        await db.transaction(async (tx) => {
            const userExists = await tx.select().from(user).where(eq(user.email, email));
            if (userExists.length > 0) {
                return res.status(400).json({ message: 'User already exists' });
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

            res.status(201).json({
                message: 'Farmer registered successfully',
                user: newUser[0]
            });
        });
    } catch (error) {
        console.error("Error registering farmer:", error);
        res.status(500).json({ message: "Failed to register farmer", error: error.message });
    }
};

export const loginFarmer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const users = await db.select().from(user).where(eq(user.email, email));
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const userInstance = users[0];

        if (userInstance.role_id !== 1) {
            return res.status(403).json({ message: 'Not authorized as a farmer' });
        }

        const isMatch = await bcrypt.compare(password, userInstance.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            ...userInstance,
            token: generateToken(userInstance.user_id),
        });
    } catch (error) {
        console.error("Error logging in farmer:", error);
        res.status(500).json({ message: "Failed to login farmer", error: error.message });
    }
};
