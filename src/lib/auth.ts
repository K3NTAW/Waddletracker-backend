import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: string;
  discord_id: string;
  username: string;
}

export const generateToken = (user: AuthUser): string => {
  return jwt.sign(user, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
};

export const verifyToken = (token: string): AuthUser | null => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
  } catch (error) {
    return null;
  }
};

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
