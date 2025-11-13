import { verifyToken } from '../utils/jwt.js';
import { db } from '../config/db.js';
import { user } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request object
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim(); // Extract token after "Bearer "
  }

  // If no token found or token is empty, return error
  if (!token || token.length === 0) {
    return res.status(401).json({ 
      success: false,
      message: 'Not authorized, no token provided' 
    });
  }

  try {
    // Verify token
    const decoded = verifyToken(token);
    
    // Fetch user from database
    const users = await db.select().from(user).where(eq(user.user_id, decoded.id));
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const userInstance = users[0];

    // Check if user is active
    if (userInstance.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'User account is not active' 
      });
    }

    // Attach user to request (exclude sensitive data)
    req.user = {
      user_id: userInstance.user_id,
      name: userInstance.name,
      email: userInstance.email,
      phone: userInstance.phone,
      role_id: userInstance.role_id,
      status: userInstance.status,
      created_at: userInstance.created_at,
      updated_at: userInstance.updated_at
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // Provide specific error messages
    let message = 'Not authorized, token failed';
    let statusCode = 401;

    if (error.message === 'Token has expired') {
      message = 'Token has expired';
    } else if (error.message === 'Invalid token') {
      message = 'Invalid token';
    } else if (error.message === 'JWT_SECRET is not configured') {
      message = 'Server configuration error';
      statusCode = 500;
    }

    return res.status(statusCode).json({ 
      success: false,
      message 
    });
  }
};

export { protect };