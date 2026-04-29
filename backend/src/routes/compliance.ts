import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const DEADLINE_TYPES: Record<string, string> = {
  MOMS_Q: 'Momsredovisning (kvartal)',
  MOMS_M: 'Momsredovisning (månadsvis)',
  ARBETSGIVAR: 'Arbetsgivardeklaration',
  INKOMST: 'Inkomstdeklaration',
  ARSREDOVISNING: 'Årsredovisning',
  CUSTOM: 'Övrigt',
};

function generateSwedishDeadlines(clientId: string, year: number): Array<{ clientId: string; type: string; dueDate: Date; status: string }> {
  const deadlines = [];
  const now = new Date();

  // Quarterly momsredovisning: Feb 12, May 12, Aug 12, Nov 12
  const momsMonths = [1, 4, 7, 10]; // 0-indexed months for Feb, May, Aug, Nov
  for (const month of momsMonths) {
    const d = new Date(year, month, 12);
    deadlines.push({ clientId, type: 'MOMS_Q', dueDate: d, status: d < now ? 'OVERDUE' : 'UPCOMING' });
  }

  // Monthly arbetsgivardeklaration: 12th of each month
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 12);
    deadlines.push({ clientId, type: 'ARBETSGIVAR', dueDate: d, status: d < now ? 'OVERDUE' : 'UPCOMING' });
  }

  // Inkomstdeklaration: May 2
  const inkomst = new Date(year, 4, 2);
  deadlines.push({ clientId, type: 'INKOMST', dueDate: inkomst, status: inkomst < now ? 'OVERDUE' : 'UPCOMING' });

  // Årsredovisning: 6 months after fiscal year end (assume Dec 31 fiscal year end → Jun 30)
  const arsredovisning = new Date(year, 5, 30);
  deadlines.push({ clientId, type: 'ARSREDOVISNING', dueDate: arsredovisning, status: arsredovisning < now ? 'OVERDUE' : 'UPCOMING' });

  return deadlines;
}

// GET /api/v1/compliance — list deadlines for org
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const { clientId, status, type, page = '1', limit = '100' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 100));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { client: { organizationId: orgId } };
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [deadlines, total] = await Promise.all([
      prisma.complianceDeadline.findMany({
        where, skip, take: limitNum,
        orderBy: { dueDate: 'asc' },
        include: { client: { select: { id: true, name: true, orgNumber: true } } },
      }),
      prisma.complianceDeadline.count({ where }),
    ]);

    const enriched = deadlines.map(d => ({ ...d, typeLabel: DEADLINE_TYPES[d.type] || d.type }));
    res.json({ deadlines: enriched, total });
  } catch (e) { next(e); }
});

// POST /api/v1/compliance/generate/:clientId — auto-generate standard deadlines
router.post('/generate/:clientId', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const { clientId } = req.params;
    const year = parseInt(req.body.year || new Date().getFullYear());

    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId: orgId } });
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    const toCreate = generateSwedishDeadlines(clientId, year);

    // Remove existing generated deadlines for this client+year to avoid duplicates
    await prisma.complianceDeadline.deleteMany({
      where: {
        clientId,
        type: { in: ['MOMS_Q', 'MOMS_M', 'ARBETSGIVAR', 'INKOMST', 'ARSREDOVISNING'] },
        dueDate: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
    });

    await prisma.complianceDeadline.createMany({ data: toCreate });

    res.json({ message: `Generated ${toCreate.length} deadlines for ${year}.`, count: toCreate.length });
  } catch (e) { next(e); }
});

// PATCH /api/v1/compliance/:id — update status/notes
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const schema = z.object({
      status: z.enum(['UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED']).optional(),
      notes: z.string().max(1000).optional(),
      dueDate: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const updated = await prisma.complianceDeadline.updateMany({
      where: { id: req.params.id, client: { organizationId: orgId } },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    if (updated.count === 0) return res.status(404).json({ error: 'Deadline not found.' });
    res.json({ message: 'Updated.' });
  } catch (e) { next(e); }
});

// DELETE /api/v1/compliance/:id
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    await prisma.complianceDeadline.deleteMany({
      where: { id: req.params.id, client: { organizationId: orgId } },
    });
    res.json({ message: 'Deleted.' });
  } catch (e) { next(e); }
});

export { router as complianceRouter };
