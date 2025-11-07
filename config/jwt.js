import 'dotenv/config';

export const secret = process.env.JWT_SECRET;
export const expiresIn = process.env.JWT_EXPIRES_IN || 3600;