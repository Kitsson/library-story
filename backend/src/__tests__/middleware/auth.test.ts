import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole, requireOrganization, AuthRequest } from '../../middleware/auth';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks so we get the mocked version
import { prisma } from '../../utils/prisma';

const JWT_SECRET = 'change-me-in-production';

function makeToken(payload: object, expiresIn: string | number = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

function buildReqRes(authHeader?: string) {
  const req = {
    headers: { authorization: authHeader },
    method: 'GET',
    path: '/test',
  } as unknown as AuthRequest;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
}

describe('authenticate middleware', () => {
  test('returns 401 when no Authorization header', async () => {
    const { req, res, next } = buildReqRes(undefined);
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Authentication required') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header missing Bearer prefix', async () => {
    const { req, res, next } = buildReqRes('Token abc123');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for expired token', async () => {
    // expiresIn: -10 places it 10 seconds in the past, outside the 60s clockTolerance
    const token = makeToken({ userId: 'user-1', type: 'access' }, -70);
    const { req, res, next } = buildReqRes(`Bearer ${token}`);
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('expired') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for malformed token', async () => {
    const { req, res, next } = buildReqRes('Bearer not.a.valid.jwt');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token type is not "access"', async () => {
    const token = makeToken({ userId: 'user-1', type: 'refresh' });
    const { req, res, next } = buildReqRes(`Bearer ${token}`);
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid token type.' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when user not found in DB', async () => {
    const token = makeToken({ userId: 'nonexistent', type: 'access' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const { req, res, next } = buildReqRes(`Bearer ${token}`);
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('not found') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for a locked account', async () => {
    const token = makeToken({ userId: 'locked-user', type: 'access' });
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'locked-user',
      email: 'locked@example.com',
      role: 'USER',
      status: 'ACTIVE',
      organizationId: 'org-1',
      lockedUntil,
    });

    const { req, res, next } = buildReqRes(`Bearer ${token}`);
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('locked'), lockedUntil })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and attaches user for a valid active token', async () => {
    const token = makeToken({ userId: 'user-active', type: 'access' });

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'user-active',
      email: 'active@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org-42',
      lockedUntil: null,
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const { req, res, next } = buildReqRes(`Bearer ${token}`);
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 'user-active',
      email: 'active@example.com',
      role: 'ADMIN',
      organizationId: 'org-42',
    });
  });
});

describe('requireRole middleware', () => {
  test('returns 401 when req.user is not set', () => {
    const req = { headers: {}, method: 'GET', path: '/' } as unknown as AuthRequest;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireRole('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when user role is not in allowed list', () => {
    const req = {
      headers: {},
      method: 'GET',
      path: '/',
      user: { id: 'u1', email: 'a@b.com', role: 'USER', organizationId: 'o1' },
    } as unknown as AuthRequest;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireRole('ADMIN', 'MANAGER')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when user has an allowed role', () => {
    const req = {
      headers: {},
      method: 'GET',
      path: '/',
      user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', organizationId: 'o1' },
    } as unknown as AuthRequest;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireRole('ADMIN', 'MANAGER')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('requireOrganization middleware', () => {
  test('returns 403 when user has no organizationId', () => {
    const req = {
      user: { id: 'u1', email: 'a@b.com', role: 'USER', organizationId: null },
    } as unknown as AuthRequest;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireOrganization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when user belongs to an organization', () => {
    const req = {
      user: { id: 'u1', email: 'a@b.com', role: 'USER', organizationId: 'org-99' },
    } as unknown as AuthRequest;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireOrganization(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
