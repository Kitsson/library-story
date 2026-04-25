import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mocks must be declared before importing the modules they replace
jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$hashed$'),
  compare: jest.fn(),
}));

import { prisma } from '../../utils/prisma';
import { authRouter } from '../../routes/auth';
import { errorHandler } from '../../middleware/errorHandler';

// Minimal app — no listen(), no rate-limiter
const testApp = express();
testApp.use(express.json());
testApp.use('/api/v1/auth', authRouter);
testApp.use(errorHandler);

const mockBcryptCompare = bcrypt.compare as jest.Mock;

const validRegisterPayload = {
  email: 'anna@firma.se',
  password: 'SuperSecret1234!',
  firstName: 'Anna',
  lastName: 'Svensson',
  orgName: 'Firma AB',
};

const baseUser = {
  id: 'user-1',
  email: 'anna@firma.se',
  passwordHash: '$hashed$',
  firstName: 'Anna',
  lastName: 'Svensson',
  role: 'ADMIN',
  organizationId: 'org-1',
  status: 'ACTIVE',
  loginAttempts: 0,
  lockedUntil: null,
  organization: { id: 'org-1', name: 'Firma AB', tier: 'KLARSTART' },
};

// ============================================================
// POST /api/v1/auth/register
// ============================================================
describe('POST /api/v1/auth/register', () => {
  test('201 - creates org and user, returns tokens', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const createdOrg = { id: 'org-new', name: 'Firma AB', tier: 'KLARSTART' };
    const createdUser = {
      id: 'user-new',
      email: 'anna@firma.se',
      firstName: 'Anna',
      lastName: 'Svensson',
      role: 'ADMIN',
      organizationId: 'org-new',
    };

    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (cb: any) =>
      cb({
        organization: { create: jest.fn().mockResolvedValue(createdOrg) },
        user: { create: jest.fn().mockResolvedValue(createdUser) },
      })
    );

    const res = await request(testApp)
      .post('/api/v1/auth/register')
      .send(validRegisterPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Registration successful/);
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('anna@firma.se');
    expect(res.body.organization.name).toBe('Firma AB');
  });

  test('409 - returns conflict when email already exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing', email: 'anna@firma.se' });

    const res = await request(testApp)
      .post('/api/v1/auth/register')
      .send(validRegisterPayload);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  test('non-201 - rejects invalid email format', async () => {
    const res = await request(testApp)
      .post('/api/v1/auth/register')
      .send({ ...validRegisterPayload, email: 'not-an-email' });

    expect(res.status).not.toBe(201);
    expect(res.body).not.toHaveProperty('tokens');
  });

  test('non-201 - rejects password shorter than 12 chars', async () => {
    const res = await request(testApp)
      .post('/api/v1/auth/register')
      .send({ ...validRegisterPayload, password: 'short' });

    expect(res.status).not.toBe(201);
    expect(res.body).not.toHaveProperty('tokens');
  });
});

// ============================================================
// POST /api/v1/auth/login
// ============================================================
describe('POST /api/v1/auth/login', () => {
  const validCreds = { email: 'anna@firma.se', password: 'SuperSecret1234!' };

  test('200 - returns tokens and user on valid credentials', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(baseUser);
    mockBcryptCompare.mockResolvedValueOnce(true);
    (prisma.user.update as jest.Mock).mockResolvedValueOnce({});

    const res = await request(testApp).post('/api/v1/auth/login').send(validCreds);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful.');
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('anna@firma.se');
  });

  test('401 - returns error on wrong password', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ ...baseUser, loginAttempts: 1 });
    mockBcryptCompare.mockResolvedValueOnce(false);
    (prisma.user.update as jest.Mock).mockResolvedValueOnce({});

    const res = await request(testApp).post('/api/v1/auth/login').send(validCreds);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/);
  });

  test('401 - returns error when user does not exist', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(testApp).post('/api/v1/auth/login').send(validCreds);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/);
  });

  test('403 - returns locked error when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      ...baseUser,
      lockedUntil,
      loginAttempts: 5,
    });

    const res = await request(testApp).post('/api/v1/auth/login').send(validCreds);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/);
    expect(res.body).toHaveProperty('lockedUntil');
  });

  test('account is locked after 5th failed attempt', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      ...baseUser,
      loginAttempts: 4, // this attempt makes it 5
    });
    mockBcryptCompare.mockResolvedValueOnce(false);

    let updateArgs: any;
    (prisma.user.update as jest.Mock).mockImplementationOnce((args: any) => {
      updateArgs = args;
      return Promise.resolve({});
    });

    const res = await request(testApp).post('/api/v1/auth/login').send(validCreds);

    expect(res.status).toBe(401);
    expect(updateArgs.data.loginAttempts).toBe(5);
    expect(updateArgs.data.lockedUntil).toBeInstanceOf(Date);
  });
});
