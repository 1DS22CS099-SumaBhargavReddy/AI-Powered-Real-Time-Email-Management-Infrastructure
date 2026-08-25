import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

export class AuthController {
  static async signup(req: Request, res: Response) {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
        requestId: (req as any).requestId
      });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
          requestId: (req as any).requestId
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          provider: 'credentials'
        }
      });

      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        success: true,
        data: {
          token,
          user: { id: user.id, name: user.name, email: user.email }
        },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Signup failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        requestId: (req as any).requestId
      });
    }
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
        requestId: (req as any).requestId
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user || !user.password) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
          requestId: (req as any).requestId
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
          requestId: (req as any).requestId
        });
      }

      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        data: {
          token,
          user: { id: user.id, name: user.name, email: user.email }
        },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Login failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        requestId: (req as any).requestId
      });
    }
  }

  static async me(req: Request, res: Response) {
    const userId = (req as any).userId;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, createdAt: true }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId: (req as any).requestId
        });
      }

      res.json({
        success: true,
        data: { user },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Get profile failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        requestId: (req as any).requestId
      });
    }
  }
}
