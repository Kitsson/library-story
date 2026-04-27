import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const entrySchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  duration: z.number().int().positive(),
  category: z.string().min(1),
  description: z.string().optional(),
  billable: z.boolean().default(true),
  hourlyRate: z.number().positive().optional(),
  clientId: z.string().uuid().optional(),
  source: z.string().optional(),
  type: z.enum(['MANUAL', 'AUTO_TRACKED', 'CALENDAR', 'EMAIL', 'CALL']).default('MANUAL'),
});

// GET /api/v1/time-entries - List with filtering
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { clientId, startDate, endDate, category, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      user: { organizationId: orgId },
    };
    if (clientId) where.clientId = clientId as string;
    if (category) where.category = category as string;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate as string);
      if (endDate) where.startedAt.lte = new Date(endDate as string);
    }

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { startedAt: 'desc' },
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.timeEntry.count({ where }),
    ]);

    res.json({ entries, total });
  } catch (e) { next(e); }
});

// POST /api/v1/time-entries - Create
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = entrySchema.parse(req.body);
    const entry = await prisma.timeEntry.create({
      data: {
        startedAt: new Date(data.startedAt),
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        duration: data.duration,
        category: data.category,
        description: data.description,
        billable: data.billable,
        hourlyRate: data.hourlyRate,
        type: data.type,
        source: data.source || 'manual',
        userId: req.user!.id,
        clientId: data.clientId || null,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.status(201).json({ message: 'Time entry created.', entry });
  } catch (e) { next(e); }
});

// GET /api/v1/time-entries/summary - Weekly summary
router.get('/summary/weekly', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    weekStart.setHours(0, 0, 0, 0);

    const entries = await prisma.timeEntry.findMany({
      where: {
        user: { organizationId: orgId },
        startedAt: { gte: weekStart },
      },
    });

    const summary = {
      totalHours: entries.reduce((sum, e) => sum + e.duration, 0) / 3600,
      billableHours: entries.filter(e => e.billable).reduce((sum, e) => sum + e.duration, 0) / 3600,
      adminHours: entries.filter(e => !e.billable).reduce((sum, e) => sum + e.duration, 0) / 3600,
      byCategory: entries.reduce((acc: Record<string, number>, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.duration / 3600;
        return acc;
      }, {}),
      byDay: entries.reduce((acc: Record<string, number>, e) => {
        const day = e.startedAt.toISOString().split('T')[0];
        acc[day] = (acc[day] || 0) + e.duration / 3600;
        return acc;
      }, {}),
    };

    res.json({ summary, weekStart });
  } catch (e) { next(e); }
});

// DELETE /api/v1/time-entries/:id
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await prisma.timeEntry.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    res.json({ message: 'Time entry deleted.' });
  } catch (e) { next(e); }
});

export { router as timeEntryRouter };