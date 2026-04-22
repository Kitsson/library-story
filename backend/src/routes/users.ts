import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

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

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, lastLogin: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users, count: users.length });
  } catch (e) { next(e); }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
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

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const { role, status, firstName, lastName } = req.body;
    const user = await prisma.user.updateMany({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      data: { role, status, firstName, lastName },
    });
    res.json({ message: 'User updated.', updated: user.count });
  } catch (e) { next(e); }
});

export { router as userRouter };