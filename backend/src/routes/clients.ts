import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1),
  orgNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { orgNumber: { contains: search as string } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, orgNumber: true, email: true,
          phone: true, industry: true, size: true, status: true,
          adviceDebt: true, totalBilled: true, totalAdvice: true,
          createdAt: true,
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({ clients, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (e) { next(e); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await prisma.client.create({
      data: data: {
  organization: {
    connect: { id: req.user!.organizationId }
  },
  // ... other fields (keep status, email, name, etc.)
},

    });
    res.status(201).json({ message: 'Client created.', client });
  } catch (e) { next(e); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: {
        _count: {
          select: { timeEntries: true, transactions: true, documentRequests: true, advisoryOpportunities: true },
        },
      },
    });
    if (!client) return res.status(404).json({ error: 'Client not found.' });
    res.json({ client });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const client = await prisma.client.updateMany({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      data: req.body,
    });
    res.json({ message: 'Client updated.', updated: client.count });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await prisma.client.deleteMany({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    res.json({ message: 'Client deleted.' });
  } catch (e) { next(e); }
});

export { router as clientRouter };