/**
 * Authentication Routes
 * Registration, login, token refresh, password management
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  orgName: z.string().min(1, 'Organization name is required'),
  orgNumber: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
}

/**
 * POST /api/v1/auth/register
 * Register a new organization with admin user
 */
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.orgName,
          orgNumber: data.orgNumber,
          tier: 'KLARSTART',
          maxUsers: 3,
          maxClients: 10,
          smsQuota: 50,
          aiQuota: 200,
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });

      return { organization, user };
    });

    const { accessToken, refreshToken } = generateTokens(result.user.id);

    logger.info(`New registration: ${data.email}, org: ${result.organization.id}`);

    res.status(201).json({
      message: 'Registration successful. Welcome to KLARY!',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        tier: result.organization.tier,
      },
      tokens: { accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { organization: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({
        error: 'Account temporarily locked due to too many failed attempts.',
        lockedUntil: user.lockedUntil,
      });
    }

    // Verify password
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      // Increment login attempts
      const attempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: attempts };
      
      if (attempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock 30 min
        logger.warn(`Account locked: ${user.email} after ${attempts} failed attempts`);
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Reset login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);

    logger.info(`Login successful: ${user.email}`);

    res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
      },
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.name,
        tier: user.organization.tier,
      } : null,
      tokens: { accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET, { clockTolerance: 60 }) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }

    const tokens = generateTokens(user.id);
    res.json({ tokens });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
    }
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 60 }) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
      },
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.name,
        tier: user.organization.tier,
        maxUsers: user.organization.maxUsers,
        maxClients: user.organization.maxClients,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };