/**
 * Global Error Handler
 * Catches all errors and returns safe responses
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error with context
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'A record with this value already exists.',
        field: err.meta?.target,
      });
    }
    // Record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Record not found.',
      });
    }
    // Foreign key constraint
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: 'Related record not found.',
      });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Invalid data provided.',
      details: isDev ? err.message : undefined,
    });
  }

  // Default error response
  res.status(500).json({
    error: 'An unexpected error occurred. Please try again later.',
    ...(isDev && { stack: err.stack, message: err.message }),
  });
}