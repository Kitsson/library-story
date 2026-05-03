import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { OpenAIService } from '../services/ai';

const router = Router();
router.use(authenticate);
const openai = new OpenAIService();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { clientId, status, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      client: { organizationId: orgId },
    };
    if (clientId) where.clientId = clientId as string;
    if (status) where.status = status as string;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, skip, take: limitNum,
        orderBy: { date: 'desc' },
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total });
  } catch (e) { next(e); }
});

// POST /api/v1/transactions/:id/categorize - AI categorization
router.post('/:id/categorize', async (req: AuthRequest, res, next) => {
  try {
    const tx = await prisma.transaction.findFirst({
      where: { id: req.params.id, client: { organizationId: req.user!.organizationId } },
      include: { client: true },
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });

    const result = await openai.categorizeTransaction({
      description: tx.description || '',
      amount: tx.amount,
      date: tx.date,
      clientIndustry: tx.client.industry || 'unknown',
    });

    await Promise.all([
      prisma.transaction.update({
        where: { id: tx.id },
        data: {
          suggestedAccount: String(result.account),
          suggestedAccountName: result.accountName || null,
          suggestedVatCode: result.vatCode ? String(result.vatCode) : null,
          aiConfidence: result.confidence,
          aiReasoning: result.reasoning,
          status: 'AI_SUGGESTED',
        },
      }),
      prisma.organization.update({
        where: { id: req.user!.organizationId! },
        data: { aiUsed: { increment: 1 } },
      }),
    ]);

    res.json({ message: 'AI categorization complete.', suggestion: result });
  } catch (e) { next(e); }
});

// POST /api/v1/transactions/:id/confirm - Confirm AI suggestion
router.post('/:id/confirm', async (req: AuthRequest, res, next) => {
  try {
    const tx = await prisma.transaction.updateMany({
      where: { id: req.params.id, client: { organizationId: req.user!.organizationId } },
      data: {
        finalAccount: req.body.account,
        finalVatCode: req.body.vatCode,
        finalCostCenter: req.body.costCenter,
        status: 'CONFIRMED',
        categorizedBy: req.user!.id,
        categorizedAt: new Date(),
      },
    });
    res.json({ message: 'Transaction confirmed.', updated: tx.count });
  } catch (e) { next(e); }
});

// POST /api/v1/transactions/bulk-categorize - Bulk AI categorization
router.post('/bulk-categorize', async (req: AuthRequest, res, next) => {
  try {
    const { ids } = req.body;
    const transactions = await prisma.transaction.findMany({
      where: { id: { in: ids }, status: 'UNCATEGORIZED', client: { organizationId: req.user!.organizationId } },
      include: { client: true },
    });

    const results = [];
    let aiCallCount = 0;
    for (const tx of transactions) {
      try {
        const result = await openai.categorizeTransaction({
          description: tx.description || '', amount: tx.amount, date: tx.date,
          clientIndustry: tx.client.industry || 'unknown',
        });
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            suggestedAccount: String(result.account), suggestedAccountName: result.accountName || null,
            suggestedVatCode: result.vatCode ? String(result.vatCode) : null,
            aiConfidence: result.confidence, aiReasoning: result.reasoning, status: 'AI_SUGGESTED',
          },
        });
        aiCallCount++;
        results.push({ id: tx.id, status: 'success', suggestion: result });
      } catch (err) {
        results.push({ id: tx.id, status: 'error', error: (err as Error).message });
      }
    }

    if (aiCallCount > 0) {
      await prisma.organization.update({
        where: { id: req.user!.organizationId! },
        data: { aiUsed: { increment: aiCallCount } },
      });
    }

    res.json({ message: `Processed ${results.length} transactions.`, results });
  } catch (e) { next(e); }
});

// POST /api/v1/transactions/seed-demo — idempotent 20 Swedish demo transactions
router.post('/seed-demo', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const client = await prisma.client.findFirst({ where: { organizationId: orgId } });
    if (!client) return res.status(400).json({ error: 'Create a client first before seeding demo data.' });

    const demo = [
      { externalId: 'demo-1',  description: 'Zoom videokonferens', amount: -1500, date: new Date('2026-01-15') },
      { externalId: 'demo-2',  description: 'Adobe Creative Cloud', amount: -599, date: new Date('2026-01-16') },
      { externalId: 'demo-3',  description: 'Kontorshyra januari', amount: -12000, date: new Date('2026-01-02') },
      { externalId: 'demo-4',  description: 'El och uppvärmning', amount: -2340, date: new Date('2026-01-10') },
      { externalId: 'demo-5',  description: 'Telia mobilabonnemang', amount: -499, date: new Date('2026-01-05') },
      { externalId: 'demo-6',  description: 'Reseersättning Stockholm', amount: -1800, date: new Date('2026-01-20') },
      { externalId: 'demo-7',  description: 'Kundintäkt faktura #1001', amount: 45000, date: new Date('2026-01-28') },
      { externalId: 'demo-8',  description: 'Försäkring företag', amount: -3200, date: new Date('2026-01-03') },
      { externalId: 'demo-9',  description: 'IT-konsult extern', amount: -15000, date: new Date('2026-01-22') },
      { externalId: 'demo-10', description: 'Lön personal februari', amount: -42000, date: new Date('2026-02-25') },
      { externalId: 'demo-11', description: 'LinkedIn Premium', amount: -899, date: new Date('2026-02-01') },
      { externalId: 'demo-12', description: 'Revisorstjänst Q1', amount: -8500, date: new Date('2026-02-14') },
      { externalId: 'demo-13', description: 'Kundintäkt faktura #1002', amount: 62000, date: new Date('2026-02-28') },
      { externalId: 'demo-14', description: 'Kontorsmaterial', amount: -1240, date: new Date('2026-02-08') },
      { externalId: 'demo-15', description: 'Microsoft 365 Business', amount: -1299, date: new Date('2026-02-03') },
      { externalId: 'demo-16', description: 'Rekryteringsannons', amount: -5600, date: new Date('2026-03-05') },
      { externalId: 'demo-17', description: 'Representation lunch kund', amount: -1875, date: new Date('2026-03-11') },
      { externalId: 'demo-18', description: 'Kundintäkt faktura #1003', amount: 38000, date: new Date('2026-03-31') },
      { externalId: 'demo-19', description: 'AWS molntjänster', amount: -3421, date: new Date('2026-03-15') },
      { externalId: 'demo-20', description: 'Utbildning & konferens', amount: -7500, date: new Date('2026-03-20') },
    ];

    let created = 0;
    for (const tx of demo) {
      await prisma.transaction.upsert({
        where: { clientId_externalId: { clientId: client.id, externalId: tx.externalId } },
        create: { ...tx, clientId: client.id, integrationId: 'demo', currency: 'SEK', status: 'UNCATEGORIZED' },
        update: {},
      });
      created++;
    }

    res.json({ message: `Demo transactions seeded (idempotent).`, count: created });
  } catch (e) { next(e); }
});

// GET /api/v1/transactions/export — stream filtered transactions as CSV
router.get('/export', async (req: AuthRequest, res, next) => {
  try {
    const { status, clientId } = req.query;
    const where: any = { client: { organizationId: req.user!.organizationId } };
    if (status) where.status = status as string;
    if (clientId) where.clientId = clientId as string;

    const transactions = await prisma.transaction.findMany({
      where, orderBy: { date: 'desc' },
      include: { client: { select: { name: true } } },
    });

    const header = 'Date,Client,Description,Amount,Currency,Status,Suggested Account,VAT Code,AI Confidence\n';
    const rows = transactions.map(tx =>
      [
        tx.date.toISOString().split('T')[0],
        `"${tx.client.name}"`,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        tx.amount,
        tx.currency,
        tx.status,
        tx.suggestedAccount || '',
        tx.suggestedVatCode || '',
        tx.aiConfidence ?? '',
      ].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(header + rows);
  } catch (e) { next(e); }
});

export { router as transactionRouter };