import jwt from 'jsonwebtoken';
import { secret } from '../config/jwt.js';
import { db } from '../config/db.js';
import { user } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, secret);
      const users = await db.select().from(user).where(eq(user.user_id, decoded.id));
      req.user = users[0];
      next();
    } catch (error) {
      console.error(error);
      res.status(401).send('Not authorized, token failed');
    }
  }

  if (!token) {
    res.status(401).send('Not authorized, no token');
  }
};

export { protect };