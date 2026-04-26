import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const PRICE_TIER_MAP: Record<string, {
  tier: 'KLARSTART' | 'KLARPRO' | 'KLARFIRM';
  maxUsers: number;
  maxClients: number;
  smsQuota: number;
  aiQuota: number;
  label: string;
}> = {
  'price_1TQDynGd49W60xYGre2aRiOO': {
    tier: 'KLARSTART', maxUsers: 3, maxClients: 10,
    smsQuota: 50, aiQuota: 200, label: 'KlarStart',
  },
  'price_1TQE4DGd49W60xYGR36TO7D3': {
    tier: 'KLARPRO', maxUsers: 15, maxClients: 50,
    smsQuota: 300, aiQuota: 99999, label: 'KlarPro',
  },
  'price_1TQE6kGd49W60xYGnEICl8aA': {
    tier: 'KLARFIRM', maxUsers: 50, maxClients: 99999,
    smsQuota: 99999, aiQuota: 99999, label: 'KlarFirm',
  },
};

function generateTempPassword(): string {
  const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `Klary-${part1}-${part2}`;
}

async function sendWelcomeEmail(
  email: string,
  firstName: string,
  tempPassword: string,
  planLabel: string,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `KLARY <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to KLARY — Your account is ready',
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 580px; margin: 0 auto; padding: 40px 24px; color: #1C1917;">
        <div style="margin-bottom: 32px;">
          <span style="font-weight: 800; font-size: 1.25rem; color: #0D7377;">KLARY</span>
        </div>
        <h1 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 12px;">
          Welcome, ${firstName}!
        </h1>
        <p style="color: #78716C; line-height: 1.7; margin-bottom: 24px;">
          Your <strong>${planLabel}</strong> subscription is active and your 14-day free trial has started.
          Here are your login credentials:
        </p>
        <div style="background: #F5F4F0; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 0.875rem; color: #78716C;">Email</p>
          <p style="margin: 0 0 16px; font-weight: 600;">${email}</p>
          <p style="margin: 0 0 8px; font-size: 0.875rem; color: #78716C;">Temporary password</p>
          <p style="margin: 0; font-weight: 700; font-size: 1.125rem; letter-spacing: 0.05em; color: #0D7377;">${tempPassword}</p>
        </div>
        <p style="color: #78716C; font-size: 0.875rem; margin-bottom: 28px;">
          Please change your password after your first login.
        </p>
        <a href="https://klaryproject.vercel.app/login"
           style="display: inline-block; background: #0D7377; color: white; padding: 14px 28px;
                  border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 1rem;">
          Log in to KLARY →
        </a>
        <p style="color: #A8A29E; font-size: 0.8125rem; margin-top: 40px; border-top: 1px solid #E7E5E4; padding-top: 20px;">
          © 2026 KLARY AB · Made in Stockholm
        </p>
      </div>
    `,
  });
}

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    logger.error('Webhook: missing stripe-signature header or STRIPE_WEBHOOK_SECRET env var');
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

  // Retrieve session with expanded line_items to get the price ID
  const session = await stripe.checkout.sessions.retrieve(rawSession.id, {
    expand: ['line_items'],
  });

  const email = session.customer_details?.email;
  const fullName = session.customer_details?.name || '';
  const stripeCustomerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id;
  const priceId = session.line_items?.data[0]?.price?.id;

  if (!email) {
    logger.error(`Webhook: no customer email in session ${session.id}`);
    return res.status(200).json({ received: true });
  }

  const tierConfig = (priceId && PRICE_TIER_MAP[priceId])
    ? PRICE_TIER_MAP[priceId]
    : PRICE_TIER_MAP['price_1TQDynGd49W60xYGre2aRiOO'];

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info(`Webhook: account already exists for ${email}, skipping`);
    return res.status(200).json({ received: true });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: fullName || email,
        stripeCustomerId: stripeCustomerId ?? null,
        tier: tierConfig.tier,
        maxUsers: tierConfig.maxUsers,
        maxClients: tierConfig.maxClients,
        smsQuota: tierConfig.smsQuota,
        aiQuota: tierConfig.aiQuota,
      },
    });

    await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: 'ADMIN',
        organizationId: org.id,
      },
    });
  });

  logger.info(`Webhook: created account for ${email} on ${tierConfig.tier}`);

  try {
    await sendWelcomeEmail(email, firstName, tempPassword, tierConfig.label);
    logger.info(`Webhook: welcome email sent to ${email}`);
  } catch (emailErr: any) {
    logger.error(`Webhook: failed to send welcome email to ${email}: ${emailErr.message}`);
  }

  return res.status(200).json({ received: true });
});

export { router as webhookRouter };
