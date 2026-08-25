import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { prisma } from '../config/prisma';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: { id: string };
}

let cachedDefaultUserId: string | null = null;

async function getOrCreateDefaultUser(): Promise<string> {
  if (cachedDefaultUserId) return cachedDefaultUserId;
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@onebox.ai',
          name: 'Demo Admin',
          provider: 'credentials'
        }
      });
    }
    cachedDefaultUserId = user.id;
    return user.id;
  } catch (err) {
    return 'demo-user-id';
  }
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token && token !== 'null' && token !== 'undefined') {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      req.userId = decoded.userId;
      req.user = { id: decoded.userId };
      return next();
    } catch (error) {
      // In development or if stale token in localStorage, fallback to default user
      if (env.NODE_ENV !== 'production') {
        const userId = await getOrCreateDefaultUser();
        req.userId = userId;
        req.user = { id: userId };
        return next();
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid or expired token'
        },
        requestId: (req as any).requestId
      });
    }
  }

  // If no token provided in dev/local mode, fallback to default user
  if (env.NODE_ENV !== 'production') {
    const userId = await getOrCreateDefaultUser();
    req.userId = userId;
    req.user = { id: userId };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Access token required'
    },
    requestId: (req as any).requestId
  });
};
