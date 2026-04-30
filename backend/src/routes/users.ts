import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../services/email';
import { buildCfg } from './emailSettings';

const router = Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

router.use(authenticate);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['MANAGER', 'USER', 'VIEWER']),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['MANAGER', 'USER', 'VIEWER']),
});

// GET /api/v1/users — list org users
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, lastLogin: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ users, count: users.length });
  } catch (e) { next(e); }
});

// POST /api/v1/users — create user directly (admin only, internal)
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        organizationId: req.user!.organizationId!,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
    });

    res.status(201).json({ message: 'User created successfully.', user });
  } catch (e) { next(e); }
});

// POST /api/v1/users/invite — send email invite with JWT link
router.post('/invite', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const { email, role } = inviteSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'A user with this email already exists.' });

    const token = jwt.sign(
      { type: 'invite', email: email.toLowerCase(), orgId, role },
      process.env.JWT_SECRET as string,
      { expiresIn: '48h' as any }
    );

    const appUrl = process.env.APP_URL || 'https://klaryproject.vercel.app';
    const inviteUrl = `${appUrl}/accept-invite?token=${token}`;

    // Send email if org has email configured
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true, resendApiKey: true },
    });

    if (org && (org.resendApiKey || org.smtpHost) && org.smtpFrom) {
      const inviter = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { firstName: true, lastName: true },
      });
      try {
        await sendInviteEmail(buildCfg(org), {
          inviteeEmail: email,
          inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : org.name,
          firmName: org.name,
          role,
          inviteUrl,
        });
      } catch (emailErr: any) {
        // Don't fail the request if email fails — return URL for manual sharing
      }
    }

    res.json({ message: 'Invitation created.', inviteUrl, emailSent: !!(org?.resendApiKey || org?.smtpHost) });
  } catch (e) { next(e); }
});

// PATCH /api/v1/users/:id — update user role/status
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      role: z.enum(['ADMIN', 'MANAGER', 'USER', 'VIEWER']).optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
    });
    const data = schema.parse(req.body);
    const updated = await prisma.user.updateMany({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      data,
    });
    res.json({ message: 'User updated.', updated: updated.count });
  } catch (e) { next(e); }
});

// DELETE /api/v1/users/:id — remove user from org
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot remove yourself.' });
    }
    const updated = await prisma.user.updateMany({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      data: { organizationId: null, status: 'INACTIVE' },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User removed from organization.' });
  } catch (e) { next(e); }
});

export { router as userRouter };
