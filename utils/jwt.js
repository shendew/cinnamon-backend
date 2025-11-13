import jwt from 'jsonwebtoken';
import { secret, expiresIn } from '../config/jwt.js';

/**
 * Generate a JWT token for a user
 * @param {number|string} userId - The user ID to encode in the token
 * @returns {string} JWT token
 * @throws {Error} If userId is missing or secret is not configured
 */
export const generateToken = (userId) => {
    if (!userId) {
        throw new Error('User ID is required to generate token');
    }

    return jwt.sign(
        { id: userId },
        secret,
        {
            expiresIn
        }
    );
};

/**
 * Verify a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid, expired, or missing required fields
 */
export const verifyToken = (token) => {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw new Error('Token is required and must be a non-empty string');
    }

    try {
        const decoded = jwt.verify(token.trim(), secret);

        if (!decoded.id) {
            throw new Error('Invalid token payload: missing user ID');
        }

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        if (error.name === 'NotBeforeError') {
            throw new Error('Token not active');
        }
        throw error;
    }
};
