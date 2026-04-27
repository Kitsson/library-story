import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;

    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [clientCount, activeClients, timeSummary, advisoryStats, docStats, revenue, org] = await Promise.all([
      prisma.client.count({ where: { organizationId: orgId } }),
      prisma.client.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      // Time this week
      prisma.timeEntry.aggregate({
        where: { user: { organizationId: orgId }, startedAt: { gte: weekStart } },
        _sum: { duration: true },
      }),
      // Advisory
      prisma.advisoryOpportunity.aggregate({
        where: { client: { organizationId: orgId }, status: 'OPEN' },
        _count: { id: true }, _sum: { estimatedValue: true },
      }),
      // Document requests
      prisma.documentRequest.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: { id: true },
      }),
      // Revenue (from time entries)
      prisma.timeEntry.aggregate({
        where: { user: { organizationId: orgId }, startedAt: { gte: monthStart }, billed: true },
        _sum: { duration: true },
      }),
      // Organization
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { tier: true, smsQuota: true, smsUsed: true, aiQuota: true, aiUsed: true, maxUsers: true, maxClients: true },
      }),
    ]);

    // Build doc status counts
    const docStatusMap = Object.fromEntries(docStats.map(s => [s.status, s._count.id]));

    res.json({
      clients: { total: clientCount, active: activeClients },
      timeThisWeek: { hours: (timeSummary._sum.duration || 0) / 3600 },
      advisory: {
        openOpportunities: advisoryStats._count.id,
        estimatedValue: advisoryStats._sum.estimatedValue || 0,
      },
      documents: {
        pending: docStatusMap['SENT'] || 0,
        partial: docStatusMap['PARTIAL'] || 0,
        completed: docStatusMap['COMPLETED'] || 0,
        overdue: docStatusMap['OVERDUE'] || 0,
      },
      revenue: { monthToDate: (revenue._sum.duration || 0) / 3600 },
      quota: org ? {
        sms: { used: org.smsUsed, total: org.smsQuota, remaining: org.smsQuota - org.smsUsed },
        ai: { used: org.aiUsed, total: org.aiQuota, remaining: org.aiQuota - org.aiUsed },
        users: org.maxUsers,
        clients: org.maxClients,
      } : null,
    });
  } catch (e) { next(e); }
});

// GET /api/v1/dashboard/activities
router.get('/activities', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;

    const [recentTime, recentAdvisory, recentDocs] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { user: { organizationId: orgId } },
        take: 5, orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } },
      }),
      prisma.advisoryOpportunity.findMany({
        where: { client: { organizationId: orgId } },
        take: 5, orderBy: { detectedAt: 'desc' },
        include: { client: { select: { name: true } } },
      }),
      prisma.documentRequest.findMany({
        where: { organizationId: orgId },
        take: 5, orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true } } },
      }),
    ]);

    res.json({ recentTime, recentAdvisory, recentDocs });
  } catch (e) { next(e); }
});

export { router as dashboardRouter };