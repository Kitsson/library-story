import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { OpenAIService } from '../services/openai';

const router = Router();
router.use(authenticate);
const openai = new OpenAIService();

// POST /api/v1/transactions/seed-demo - Load 20 realistic Swedish demo transactions
router.post('/seed-demo', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;

    let demoClient = await prisma.client.findFirst({
      where: { organizationId: orgId, name: 'Demo AB' },
    });

    if (!demoClient) {
      demoClient = await prisma.client.create({
        data: {
          organizationId: orgId,
          name: 'Demo AB',
          orgNumber: '556000-0000',
          email: 'demo@demoab.se',
          industry: 'Consulting',
          size: 'SMALL',
          status: 'ACTIVE',
        },
      });
    }

    const now = new Date();
    const demoTransactions = [
      { externalId: 'demo-01', description: 'Hyra kontor Q1 2024', amount: 25000, daysAgo: 28 },
      { externalId: 'demo-02', description: 'Kontorsmaterial Staples', amount: 1250, daysAgo: 26 },
      { externalId: 'demo-03', description: 'Microsoft 365 abonnemang', amount: 890, daysAgo: 25 },
      { externalId: 'demo-04', description: 'Lunch kundmöte Restaurang Nytorget', amount: 450, daysAgo: 24 },
      { externalId: 'demo-05', description: 'Resa SJ Stockholm-Göteborg', amount: 1890, daysAgo: 22 },
      { externalId: 'demo-06', description: 'Mobiltelefon Telia Business', amount: 650, daysAgo: 21 },
      { externalId: 'demo-07', description: 'Konsultarvode redovisning april', amount: 12500, daysAgo: 20 },
      { externalId: 'demo-08', description: 'Företagsförsäkring If Skadeförsäkring', amount: 3200, daysAgo: 18 },
      { externalId: 'demo-09', description: 'El och vatten kontor', amount: 2100, daysAgo: 17 },
      { externalId: 'demo-10', description: 'Fortnox bokföringsprogram', amount: 399, daysAgo: 16 },
      { externalId: 'demo-11', description: 'LinkedIn annonsering april', amount: 5000, daysAgo: 14 },
      { externalId: 'demo-12', description: 'Porto och frakt DHL', amount: 340, daysAgo: 13 },
      { externalId: 'demo-13', description: 'Facklitteratur Bonnier', amount: 890, daysAgo: 12 },
      { externalId: 'demo-14', description: 'Kontorsmöbler IKEA', amount: 8500, daysAgo: 10 },
      { externalId: 'demo-15', description: 'Webbhotell One.com', amount: 299, daysAgo: 9 },
      { externalId: 'demo-16', description: 'Städtjänst kontor Städarna AB', amount: 1800, daysAgo: 7 },
      { externalId: 'demo-17', description: 'Kundmiddag Operakällaren', amount: 2100, daysAgo: 6 },
      { externalId: 'demo-18', description: 'Revisionsarvode Ernst & Young', amount: 15000, daysAgo: 4 },
      { externalId: 'demo-19', description: 'Utbildning Accountor Academy', amount: 6500, daysAgo: 2 },
      { externalId: 'demo-20', description: 'Zoom videokonferens', amount: 149, daysAgo: 1 },
    ];

    let created = 0;
    for (const tx of demoTransactions) {
      const date = new Date(now);
      date.setDate(date.getDate() - tx.daysAgo);
      await prisma.transaction.upsert({
        where: { clientId_externalId: { clientId: demoClient.id, externalId: tx.externalId } },
        update: {},
        create: {
          clientId: demoClient.id,
          externalId: tx.externalId,
          description: tx.description,
          amount: tx.amount,
          currency: 'SEK',
          date,
          status: 'UNCATEGORIZED',
          integrationId: 'demo',
        },
      });
      created++;
    }

    res.json({ message: `Demo data loaded. ${created} transactions ready to categorize.`, clientId: demoClient.id, created });
  } catch (e) { next(e); }
});

// GET /api/v1/transactions/export - Download transactions as CSV
router.get('/export', async (req: AuthRequest, res, next) => {
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

    const headers = [
      'Date', 'Client', 'Description', 'Amount', 'Currency', 'Status',
      'AI Account', 'AI VAT Code', 'AI Confidence (%)', 'AI Reasoning',
      'Final Account', 'Final VAT Code', 'Categorized At',
    ];

    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = transactions.map(tx => [
      new Date(tx.date).toISOString().split('T')[0],
      tx.client.name,
      tx.description || '',
      tx.amount,
      tx.currency,
      tx.status,
      tx.suggestedAccount || '',
      tx.suggestedVatCode || '',
      tx.aiConfidence != null ? (tx.aiConfidence * 100).toFixed(0) : '',
      tx.aiReasoning || '',
      tx.finalAccount || '',
      tx.finalVatCode || '',
      tx.categorizedAt ? new Date(tx.categorizedAt).toISOString().split('T')[0] : '',
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="klary-transactions.csv"');
    res.send(csv);
  } catch (e) { next(e); }
});

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