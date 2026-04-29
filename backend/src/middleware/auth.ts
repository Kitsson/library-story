/**
 * Authentication Middleware
 * JWT token validation with organization context
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set a 64+ character random string.');
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId: string | null;
  };
}

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, {
      clockTolerance: 60, // 60 second tolerance for clock skew
    }) as { userId: string; type: string };
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }
    
    // Fetch user from database (with caching opportunity here)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true },
    });
    
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }
    
    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({
        error: 'Account temporarily locked. Please try again later.',
        lockedUntil: user.lockedUntil,
      });
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    
    // Update last login (async, don't block)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    }).catch(err => logger.error('Failed to update lastLogin:', err));
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    logger.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error.' });
  }
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(`Role violation: ${req.user.id} attempted ${req.method} ${req.path} with role ${req.user.role}`);
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

/**
 * Require organization membership (prevent cross-org access)
 */
export function requireOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.organizationId) {
    return res.status(403).json({ error: 'Organization membership required.' });
  }
  next();
}

/**
 * Optional auth - doesn't fail if no token
 */
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 60 }) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (user && user.status === 'ACTIVE') {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        };
      }
    }
  } catch {
    // Silently ignore - optional auth
  }
  next();
}