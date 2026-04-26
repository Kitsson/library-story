import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia' as any,
});

const PRICE_IDS = {
  monthly: {
    klarstart: process.env.STRIPE_PRICE_KLARSTART_MONTHLY!,
    klarpro:   process.env.STRIPE_PRICE_KLARPRO_MONTHLY!,
    klarfirm:  process.env.STRIPE_PRICE_KLARFIRM_MONTHLY!,
  },
  yearly: {
    klarstart: process.env.STRIPE_PRICE_KLARSTART_YEARLY!,
    klarpro:   process.env.STRIPE_PRICE_KLARPRO_YEARLY!,
    klarfirm:  process.env.STRIPE_PRICE_KLARFIRM_YEARLY!,
  },
};

const planToTier: Record<string, string> = {
  klarstart: 'KLARSTART',
  klarpro:   'KLARPRO',
  klarfirm:  'KLARFIRM',
};

// POST /api/stripe/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { plan, billing, email } = req.body;

    const billingKey = billing as keyof typeof PRICE_IDS;
    const planKey = plan as keyof typeof PRICE_IDS.monthly;
    const priceId = PRICE_IDS[billingKey]?.[planKey];

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing cycle' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/register?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/pricing?canceled=true`,
      metadata: { plan, billing },
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan, billing },
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/webhook  (raw body set by server.ts before express.json)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan || 'klarstart';

      await prisma.organization.create({
        data: {
          name: session.customer_details?.name || 'New Firm',
          email: session.customer_email,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          tier: planToTier[plan] as any,
          billing: session.metadata?.billing || 'monthly',
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      console.log('New subscription created for:', session.customer_email);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      await prisma.organization.updateMany({
        where: { stripeCustomerId: invoice.customer as string },
        data: { subscriptionStatus: 'ACTIVE' },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object as Stripe.Invoice;
      await prisma.organization.updateMany({
        where: { stripeCustomerId: failedInvoice.customer as string },
        data: { subscriptionStatus: 'PAYMENT_FAILED' },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.organization.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { subscriptionStatus: 'CANCELLED' },
      });
      break;
    }
  }

  res.json({ received: true });
});

// GET /api/stripe/subscription-status?sessionId=xxx
router.get('/subscription-status', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const session = await stripe.checkout.sessions.retrieve(sessionId as string);
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    res.json({
      status: subscription.status,
      plan: session.metadata?.plan,
      billing: session.metadata?.billing,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

export { router as stripeRouter };
