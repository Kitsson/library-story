/**
 * KLARY Backend Server
 * Express + TypeScript + Prisma + Security Hardening
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { clientRouter } from './routes/clients';
import { timeEntryRouter } from './routes/timeEntries';
import { transactionRouter } from './routes/transactions';
import { advisoryRouter } from './routes/advisory';
import { documentRequestRouter } from './routes/documentRequests';
import { uploadRouter } from './routes/uploads';
import { integrationRouter, fortnoxOAuthRouter } from './routes/integrations';
import { dashboardRouter } from './routes/dashboard';
import { webhookRouter } from './routes/webhooks';
import { emailSettingsRouter } from './routes/emailSettings';
import { startSyncScheduler } from './utils/syncScheduler';
import { errorHandler } from './middleware/errorHandler';
import { requestValidator } from './middleware/requestValidator';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet: Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS: Restrict to known origins
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
    retryAfter: 900,
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: 900,
    });
  },
});
app.use(rateLimiter);

// Stricter rate limit for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});
app.use('/api/v1/auth/login', authRateLimiter);
app.use('/api/v1/auth/register', authRateLimiter);

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Stripe webhook — raw body required for signature verification, must be before express.json()
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }), webhookRouter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request validation
app.use(requestValidator);

// ============================================
// ROUTES
// ============================================

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/clients', clientRouter);
app.use('/api/v1/time-entries', timeEntryRouter);
app.use('/api/v1/transactions', transactionRouter);
app.use('/api/v1/advisory', advisoryRouter);
app.use('/api/v1/document-requests', documentRequestRouter);
app.use('/api/v1/uploads', uploadRouter);
app.use('/api/v1/integrations', integrationRouter);
app.use('/api/v1/integrations', fortnoxOAuthRouter); // unauthenticated OAuth callback
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/email-settings', emailSettingsRouter);

// Client portal (public, no auth required for upload)
app.use('/portal', express.static(path.join(__dirname, '../public/portal')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API root
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'KLARY API',
    version: '1.1.0-supabase',
    documentation: '/api/v1/docs',
    endpoints: [
      '/api/v1/auth',
      '/api/v1/users',
      '/api/v1/clients',
      '/api/v1/time-entries',
      '/api/v1/transactions',
      '/api/v1/advisory',
      '/api/v1/document-requests',
      '/api/v1/uploads',
      '/api/v1/integrations',
      '/api/v1/dashboard',
    ],
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`🚀 KLARY Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔒 CORS origin: ${corsOrigin}`);

  if (process.env.FORTNOX_CLIENT_ID) {
    startSyncScheduler();
  }
});

export { app };