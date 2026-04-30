import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { buildFortnoxAuthUrl, exchangeFortnoxCode, syncFortnox } from '../services/fortnox';
import { logger } from '../utils/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;
const APP_URL = process.env.APP_URL || 'https://klaryproject.vercel.app';

// GET /api/v1/fortnox/authorize-url — returns the Fortnox OAuth URL (frontend redirects to it)
router.get('/authorize-url', authenticate, (req: AuthRequest, res) => {
  const state = jwt.sign(
    { userId: req.user!.id, orgId: req.user!.organizationId, type: 'fortnox_oauth' },
    JWT_SECRET,
    { expiresIn: '10m' as any }
  );
  res.json({ url: buildFortnoxAuthUrl(state) });
});

// GET /api/v1/fortnox/callback — Fortnox redirects here after user authorizes
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    logger.warn(`Fortnox OAuth denied or missing params: ${error}`);
    return res.redirect(`${APP_URL}/integrations?error=fortnox_denied`);
  }

  let payload: any;
  try {
    payload = jwt.verify(state, JWT_SECRET) as any;
    if (payload.type !== 'fortnox_oauth') throw new Error('invalid type');
  } catch {
    return res.redirect(`${APP_URL}/integrations?error=invalid_state`);
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeFortnoxCode(code);

    await prisma.accountingIntegration.upsert({
      where: { organizationId_provider: { organizationId: payload.orgId, provider: 'FORTNOX' } },
      update: {
        accessToken,
        refreshToken,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      create: {
        provider: 'FORTNOX',
        name: 'Fortnox',
        accessToken,
        refreshToken,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
        organizationId: payload.orgId,
        status: 'ACTIVE',
        syncEnabled: true,
      },
    });

    logger.info(`Fortnox connected for org ${payload.orgId}`);
    res.redirect(`${APP_URL}/integrations?connected=fortnox`);
  } catch (e: any) {
    logger.error(`Fortnox token exchange failed: ${e.message}`);
    res.redirect(`${APP_URL}/integrations?error=fortnox_exchange_failed`);
  }
});

// GET /api/v1/fortnox/status
router.get('/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const integration = await prisma.accountingIntegration.findUnique({
      where: { organizationId_provider: { organizationId: req.user!.organizationId!, provider: 'FORTNOX' } },
      select: { id: true, status: true, lastSyncAt: true, createdAt: true },
    });
    res.json({ connected: !!integration, integration: integration ?? null });
  } catch (e) { next(e); }
});

// POST /api/v1/fortnox/sync — trigger manual sync
router.post('/sync', authenticate, async (req: AuthRequest, res) => {
  try {
    const results = await syncFortnox(req.user!.organizationId!);
    res.json({ message: 'Sync complete.', ...results });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/v1/fortnox/disconnect
router.delete('/disconnect', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.accountingIntegration.deleteMany({
      where: { organizationId: req.user!.organizationId!, provider: 'FORTNOX' },
    });
    logger.info(`Fortnox disconnected for org ${req.user!.organizationId}`);
    res.json({ message: 'Fortnox disconnected.' });
  } catch (e) { next(e); }
});

export { router as fortnoxRouter };
