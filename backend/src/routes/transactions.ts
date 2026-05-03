import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { OpenAIService } from '../services/openai';

const router = Router();
router.use(authenticate);
const openai = new OpenAIService();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { clientId, status, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      client: { organizationId: orgId },
    };
    if (clientId) where.clientId = clientId as string;
    if (status) where.status = status as string;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, skip, take: parseInt(limit as string),
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

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        suggestedAccount: result.account,
        suggestedVatCode: result.vatCode,
        aiConfidence: result.confidence,
        aiReasoning: result.reasoning,
        status: 'AI_SUGGESTED',
      },
    });

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

// POST /api/v1/transactions/seed-demo - Seed 20 Swedish demo transactions (idempotent)
const DEMO_TRANSACTIONS = [
  { externalId: 'demo-001', description: 'Fortnox abonnemang', amount: -399, date: new Date('2024-01-05') },
  { externalId: 'demo-002', description: 'Hyra kontor Stockholm', amount: -18500, date: new Date('2024-01-01') },
  { externalId: 'demo-003', description: 'Zoom videokonferens', amount: -149, date: new Date('2024-01-10') },
  { externalId: 'demo-004', description: 'Swish betalning kund AB', amount: 12000, date: new Date('2024-01-12') },
  { externalId: 'demo-005', description: 'El & värme kontor', amount: -2340, date: new Date('2024-01-03') },
  { externalId: 'demo-006', description: 'Kontorsmaterial Staples', amount: -876, date: new Date('2024-01-15') },
  { externalId: 'demo-007', description: 'Reseersättning bil', amount: -1200, date: new Date('2024-01-18') },
  { externalId: 'demo-008', description: 'Lön konsult januari', amount: -45000, date: new Date('2024-01-25') },
  { externalId: 'demo-009', description: 'Google Workspace Business', amount: -1380, date: new Date('2024-01-08') },
  { externalId: 'demo-010', description: 'Mobilabonnemang Tele2', amount: -499, date: new Date('2024-01-06') },
  { externalId: 'demo-011', description: 'Revisorarvode Q4', amount: -8500, date: new Date('2024-01-20') },
  { externalId: 'demo-012', description: 'Bankavgifter Swedbank', amount: -125, date: new Date('2024-01-31') },
  { externalId: 'demo-013', description: 'Friskvård personal', amount: -5000, date: new Date('2024-01-22') },
  { externalId: 'demo-014', description: 'Representation lunch kund', amount: -1890, date: new Date('2024-01-17') },
  { externalId: 'demo-015', description: 'IT-utrustning laptop', amount: -15990, date: new Date('2024-01-14') },
  { externalId: 'demo-016', description: 'Programvarulicens Adobe', amount: -599, date: new Date('2024-01-09') },
  { externalId: 'demo-017', description: 'Kurslitteratur utbildning', amount: -320, date: new Date('2024-01-23') },
  { externalId: 'demo-018', description: 'Reklamkostnad LinkedIn', amount: -3200, date: new Date('2024-01-16') },
  { externalId: 'demo-019', description: 'Frakt & porto PostNord', amount: -245, date: new Date('2024-01-28') },
  { externalId: 'demo-020', description: 'Övriga kontorskostnader', amount: -680, date: new Date('2024-01-30') },
];

router.post('/seed-demo', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const demoIntegrationId = 'demo-integration';

    // Find or create a demo client for this org
    const demoClient = await prisma.client.upsert({
      where: { id: `demo-client-${orgId}` },
      update: {},
      create: {
        id: `demo-client-${orgId}`,
        name: 'Demo Client AB',
        organizationId: orgId,
        industry: 'technology',
      },
    });

    // Upsert all 20 transactions (idempotent via unique [clientId, externalId])
    for (const tx of DEMO_TRANSACTIONS) {
      await prisma.transaction.upsert({
        where: { clientId_externalId: { clientId: demoClient.id, externalId: tx.externalId } },
        update: {},
        create: {
          clientId: demoClient.id,
          externalId: tx.externalId,
          description: tx.description,
          amount: tx.amount,
          currency: 'SEK',
          date: tx.date,
          status: 'UNCATEGORIZED',
          integrationId: demoIntegrationId,
        },
      });
    }

    res.json({ message: '20 transactions ready', count: 20 });
  } catch (e) { next(e); }
});

// GET /api/v1/transactions/export/csv - Export transactions as CSV
router.get('/export/csv', async (req: AuthRequest, res, next) => {
  try {
    const { clientId, status } = req.query;
    const orgId = req.user!.organizationId!;

    const where: any = { client: { organizationId: orgId } };
    if (clientId) where.clientId = clientId as string;
    if (status) where.status = status as string;

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { client: { select: { name: true } } },
    });

    const header = 'Date,Description,Amount,Currency,Status,Client,Account';
    const rows = transactions.map(tx => [
      tx.date.toISOString().split('T')[0],
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.amount,
      tx.currency,
      tx.status,
      `"${tx.client.name.replace(/"/g, '""')}"`,
      tx.finalAccount || tx.suggestedAccount || '',
    ].join(','));

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="klary-transactions.csv"');
    res.send(csv);
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
    for (const tx of transactions) {
      try {
        const result = await openai.categorizeTransaction({
          description: tx.description || '', amount: tx.amount, date: tx.date,
          clientIndustry: tx.client.industry || 'unknown',
        });
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            suggestedAccount: result.account, suggestedVatCode: result.vatCode,
            aiConfidence: result.confidence, aiReasoning: result.reasoning, status: 'AI_SUGGESTED',
          },
        });
        results.push({ id: tx.id, status: 'success', suggestion: result });
      } catch (err) {
        results.push({ id: tx.id, status: 'error', error: (err as Error).message });
      }
    }

    res.json({ message: `Processed ${results.length} transactions.`, results });
  } catch (e) { next(e); }
});

export { router as transactionRouter };