/**
 * Request Validation Middleware
 * Basic input sanitization
 */

import { Request, Response, NextFunction } from 'express';

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
  /(--|#|\/\*|\*\/)/,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
];

export function requestValidator(req: Request, res: Response, next: NextFunction) {
  // Check for SQL injection in query params
  const queryString = JSON.stringify(req.query);
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(queryString)) {
      return res.status(400).json({ error: 'Invalid request parameters.' });
    }
  }

  // Check for XSS in body
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body);
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(bodyString)) {
        return res.status(400).json({ error: 'Invalid request content.' });
      }
    }
  }

  // Set request ID for tracing
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();

  next();
}