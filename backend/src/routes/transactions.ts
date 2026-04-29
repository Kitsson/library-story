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
          suggestedAccount: result.account,
          suggestedVatCode: result.vatCode,
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
            suggestedAccount: result.account, suggestedVatCode: result.vatCode,
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

export { router as transactionRouter };