import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { TIER_PRICE_MAP, TIER_ORDER } from '../config/tiers';

const router = Router();
router.use(authenticate);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// GET /api/v1/billing/status — org billing snapshot
router.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      include: {
        _count: {
          select: {
            users: { where: { status: { not: 'INACTIVE' } } },
            clients: true,
          },
        },
      },
    });

    if (!org) return res.status(404).json({ error: 'Organization not found.' });

    res.json({
      tier: org.tier,
      maxUsers: org.maxUsers,
      currentUsers: org._count.users,
      maxClients: org.maxClients,
      currentClients: org._count.clients,
      smsQuota: org.smsQuota,
      smsUsed: org.smsUsed,
      aiQuota: org.aiQuota,
      aiUsed: org.aiUsed,
    });
  } catch (e) { next(e); }
});

// POST /api/v1/billing/checkout — create Stripe Checkout session (ADMIN only)
router.post('/checkout', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { tier } = z.object({
      tier: z.enum(['KLARSTART', 'KLARPRO', 'KLARFIRM']),
    }).parse(req.body);

    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { tier: true, stripeCustomerId: true },
    });

    if (!org) return res.status(404).json({ error: 'Organization not found.' });

    const currentTier = org.tier as 'KLARSTART' | 'KLARPRO' | 'KLARFIRM';
    if (TIER_ORDER[tier] <= TIER_ORDER[currentTier]) {
      return res.status(400).json({ error: 'You can only upgrade to a higher plan.' });
    }

    const priceId = TIER_PRICE_MAP[tier];
    const appUrl = process.env.APP_URL || 'https://klaryproject.vercel.app';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?payment=success`,
      cancel_url: `${appUrl}/settings?payment=cancelled`,
    };

    if (org.stripeCustomerId) {
      sessionParams.customer = org.stripeCustomerId;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { email: true },
      });
      if (user?.email) sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (e) { next(e); }
});

export { router as billingRouter };
