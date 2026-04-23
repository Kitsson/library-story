import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { OpenAIService } from '../services/openai';

const router = Router();
router.use(authenticate);
const openai = new OpenAIService();

// GET /api/v1/advisory/opportunities
router.get('/opportunities', async (req: AuthRequest, res, next) => {
  try {
    const { status, priority, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { client: { organizationId: orgId } };
    if (status) where.status = status as string;
    if (priority) where.priority = priority as string;

    const [opportunities, total] = await Promise.all([
      prisma.advisoryOpportunity.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { detectedAt: 'desc' },
        include: { client: { select: { id: true, name: true, industry: true } },
          user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.advisoryOpportunity.count({ where }),
    ]);

    res.json({ opportunities, total });
  } catch (e) { next(e); }
});

// POST /api/v1/advisory/detect - Analyze client activity for advisory
router.post('/detect', async (req: AuthRequest, res, next) => {
  try {
    const { clientId, content } = req.body;
    const orgId = req.user!.organizationId!;

    // Check client exists and belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: orgId },
    });
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    // Detect advisory content with AI
    const detection = await openai.detectAdvisoryOpportunity(content);

    // Log the activity
    await prisma.clientActivity.create({
      data: {
        clientId,
        type: 'QUESTION_ASKED',
        content,
        channel: 'portal',
        isAdvisory: detection.isAdvisory,
        aiConfidence: detection.confidence,
        topics: detection.topics,
      },
    });

    // If advisory detected, create or update opportunity
    if (detection.isAdvisory && detection.confidence > 0.6) {
      const existing = await prisma.advisoryOpportunity.findFirst({
        where: { clientId, status: { in: ['OPEN', 'IN_PROGRESS'] }, type: detection.type as any },
      });

      if (existing) {
        // Update existing opportunity
        await prisma.advisoryOpportunity.update({
          where: { id: existing.id },
          data: {
            estimatedHours: (existing.estimatedHours || 0) + 0.5,
            estimatedValue: (existing.estimatedValue || 0) + 1250,
          },
        });
      } else {
        // Create new opportunity
        await prisma.advisoryOpportunity.create({
          data: {
            clientId,
            title: `Advisory: ${detection.topics.join(', ')}`,
            description: `Detected from client communication:\n${content.substring(0, 500)}`,
            type: detection.type as any,
            detectedAt: new Date(),
            detectedBy: 'AI',
            estimatedHours: 1,
            estimatedValue: 2500,
            status: 'OPEN',
            priority: detection.confidence > 0.8 ? 'HIGH' : 'MEDIUM',
            evidence: JSON.stringify({ content: content.substring(0, 1000), topics: detection.topics }),
          },
        });
      }
    }

    res.json({ detection, advisoryCreated: detection.isAdvisory && detection.confidence > 0.6 });
  } catch (e) { next(e); }
});

// PATCH /api/v1/advisory/opportunities/:id - Update status
router.patch('/opportunities/:id', async (req: AuthRequest, res, next) => {
  try {
    const { status, priority, assignedTo, resolution } = req.body;
    const opp = await prisma.advisoryOpportunity.updateMany({
      where: { id: req.params.id, client: { organizationId: req.user!.organizationId } },
      data: {
        status, priority, assignedTo,
        resolution, resolvedBy: resolution ? req.user!.id : undefined,
        resolvedAt: resolution ? new Date() : undefined,
      },
    });
    res.json({ message: 'Opportunity updated.', updated: opp.count });
  } catch (e) { next(e); }
});

// GET /api/v1/advisory/dashboard
router.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;

    const [openOpps, convertedThisMonth, totalAdviceValue, byType] = await Promise.all([
      prisma.advisoryOpportunity.count({
        where: { client: { organizationId: orgId }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.advisoryOpportunity.count({
        where: {
          client: { organizationId: orgId }, status: 'CONVERTED',
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.advisoryOpportunity.aggregate({
        where: { client: { organizationId: orgId }, status: 'CONVERTED' },
        _sum: { actualValue: true },
      }),
      prisma.advisoryOpportunity.groupBy({
        by: ['type'],
        where: { client: { organizationId: orgId } },
        _count: { id: true },
        _sum: { estimatedValue: true },
      }),
    ]);

    res.json({
      openOpportunities: openOpps,
      convertedThisMonth,
      totalConvertedValue: totalAdviceValue._sum.actualValue || 0,
      byType,
    });
  } catch (e) { next(e); }
});

export { router as advisoryRouter };