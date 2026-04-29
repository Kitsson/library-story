import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { PRICE_TIER_MAP } from '../config/tiers';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// Stripe sends checkout.session.completed when a customer pays.
// If they've already registered, upgrade their org to the paid tier.
// If not yet registered, do nothing — the register route handles tier assignment on sign-up.
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    logger.error('Webhook: missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return res.status(400).json({ error: 'Webhook configuration error' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const rawSession = event.data.object as Stripe.Checkout.Session;
  const session = await stripe.checkout.sessions.retrieve(rawSession.id, {
    expand: ['line_items'],
  });

  const email = session.customer_details?.email;
  const priceId = session.line_items?.data[0]?.price?.id;
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;

  if (!email) {
    logger.warn(`Webhook: no email in session ${session.id}`);
    return res.status(200).json({ received: true });
  }

  const tierConfig = priceId ? PRICE_TIER_MAP[priceId] : null;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (user?.organization && tierConfig) {
    await prisma.organization.update({
      where: { id: user.organization.id },
      data: {
        tier: tierConfig.tier,
        maxUsers: tierConfig.maxUsers,
        maxClients: tierConfig.maxClients,
        smsQuota: tierConfig.smsQuota,
        aiQuota: tierConfig.aiQuota,
        stripeCustomerId,
      },
    });
    logger.info(`Webhook: upgraded ${email} to ${tierConfig.tier}`);
  } else {
    logger.info(`Webhook: ${email} not registered yet — tier will be applied on sign-up`);
  }

  return res.status(200).json({ received: true });
});

export { router as webhookRouter };
