import { db } from '../config/db.js';
import { user } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { secret } from '../config/jwt.js';
import { validationResult } from 'express-validator';

const generateToken = (id) => {
    return jwt.sign({ id }, secret, {
        expiresIn: '30d',
    });
};

export const registerAdmin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone } = req.body;

    try {
        const userExists = await db.select().from(user).where(eq(user.email, email));
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
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

        res.status(201).json({
            ...newAdmin[0],
            token: generateToken(newAdmin[0].user_id),
        });
    } catch (error) {
        console.error("Error registering admin:", error);
        res.status(500).json({ message: "Failed to register admin", error: error.message });
    }
};


export const loginUser = async (req, res) => {
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
        const isMatch = await bcrypt.compare(password, userInstance.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            ...userInstance,
            token: generateToken(userInstance.user_id),
        });
    } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ message: "Failed to login user", error: error.message });
    }
};

export const getUserProfile = async (req, res) => {
    try {
        const users = await db.select().from(user).where(eq(user.user_id, req.user.user_id));
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(users[0]);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Failed to fetch user profile", error: error.message });
    }
};

export const updateUserProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, phone } = req.body;
        const updatedUser = await db.update(user).set({ name, email, phone, updated_at: new Date() }).where(eq(user.user_id, req.user.user_id)).returning();

        res.json(updatedUser[0]);
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Failed to update user profile", error: error.message });
    }
};
