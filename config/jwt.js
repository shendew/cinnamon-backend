import 'dotenv/config';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
export const secret = process.env.JWT_SECRET;

// Parse expiration time
const parseExpiresIn = (value) => {
    if (!value) return '30d';
    
    if (!isNaN(value)) {
        return parseInt(value);
    }
    return value;
};

export const expiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN || '30d');