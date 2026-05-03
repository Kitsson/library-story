import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt, hashValue } from '../utils/crypto';
import { logger } from '../utils/logger';
import { parseSIE4 } from '../services/sie4Parser';
import { mapSIE4ToTransactions } from '../services/integrationMapper';
import {
  buildAuthorizeUrl, exchangeCode, refreshAccessToken,
  FortnoxClient, mapVouchersToTransactions,
} from '../services/fortnoxClient';
import { runSync } from '../utils/syncScheduler';

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/v1/integrations - List connected integrations
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const integrations = await prisma.accountingIntegration.findMany({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true, provider: true, name: true, status: true,
        syncEnabled: true, lastSyncAt: true, createdAt: true,
      },
    });
    res.json({ integrations });
  } catch (e) { next(e); }
});

// POST /api/v1/integrations - Connect new integration
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      provider: z.enum(['FORTNOX', 'VISMA_EEKONOMI', 'BJORN_LUNDEN', 'ECONOMIC', 'TRIPLETEX', 'BOKIO']),
      name: z.string().min(1),
      accessToken: z.string().min(1),
      refreshToken: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // Encrypt tokens before storage
    const encryptedAccess = encrypt(data.accessToken);
    const encryptedRefresh = data.refreshToken ? encrypt(data.refreshToken) : null;

    const integration = await prisma.accountingIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: req.user!.organizationId!,
          provider: data.provider,
        },
      },
      update: {
        name: data.name,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        status: 'ACTIVE',
      },
      create: {
        provider: data.provider,
        name: data.name,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        organizationId: req.user!.organizationId!,
        status: 'ACTIVE',
      },
    });

    logger.info(`Integration connected: ${data.provider} for org ${req.user!.organizationId}`);
    res.status(201).json({ message: 'Integration connected.', integration: { id: integration.id, provider: integration.provider, name: integration.name, status: integration.status } });
  } catch (e) { next(e); }
});

// GET /api/v1/integrations/providers - Available providers
router.get('/providers/list', async (_req: AuthRequest, res) => {
  const providers = [
    { id: 'FORTNOX', name: 'Fortnox', description: 'Sweden #1 - Full API', status: 'available', countries: ['SE'] },
    { id: 'VISMA_EEKONOMI', name: 'Visma eEkonomi', description: 'Sweden/Norway - Full API', status: 'available', countries: ['SE', 'NO'] },
    { id: 'BJORN_LUNDEN', name: 'Björn Lundén', description: 'Sweden - Full API', status: 'available', countries: ['SE'] },
    { id: 'ECONOMIC', name: 'e-conomic', description: 'Denmark #1 - Full API', status: 'available', countries: ['DK'] },
    { id: 'TRIPLETEX', name: 'Tripletex', description: 'Norway #1 - Full API', status: 'available', countries: ['NO'] },
    { id: 'BOKIO', name: 'Bokio', description: 'Sweden - API', status: 'available', countries: ['SE'] },
    { id: 'FIKEN', name: 'Fiken', description: 'Norway - API', status: 'coming_soon', countries: ['NO'] },
    { id: 'DINERO', name: 'Dinero', description: 'Denmark - API', status: 'coming_soon', countries: ['DK'] },
    { id: 'BILLY', name: 'Billy', description: 'Denmark - API', status: 'coming_soon', countries: ['DK'] },
    { id: 'SIE4_FILE', name: 'SIE4 File Import', description: 'Universal - File-based', status: 'available', countries: ['SE', 'NO', 'DK'] },
  ];
  res.json({ providers });
});

// POST /api/v1/integrations/sie4/import - Import SIE4 file
router.post('/sie4/import', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const { clientId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!clientId) return res.status(400).json({ error: 'clientId is required.' });

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: req.user!.organizationId },
    });
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    const content = req.file.buffer.toString('latin1'); // SIE4 uses ISO-8859-1
    const sie4Data = parseSIE4(content);

    // Find or create integration record for SIE4
    const integration = await prisma.accountingIntegration.upsert({
      where: { organizationId_provider: { organizationId: req.user!.organizationId!, provider: 'SIE4_FILE' } },
      update: { lastSyncAt: new Date() },
      create: {
        provider: 'SIE4_FILE',
        name: `SIE4 - ${sie4Data.company}`,
        accessToken: 'n/a',
        organizationId: req.user!.organizationId!,
        status: 'ACTIVE',
      },
    });

    const mapped = mapSIE4ToTransactions(sie4Data.transactions, clientId, integration.id);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tx of mapped) {
      try {
        await prisma.transaction.upsert({
          where: { clientId_externalId: { clientId, externalId: tx.externalId } },
          update: {},
          create: {
            clientId,
            externalId: tx.externalId,
            description: tx.description,
            amount: tx.amount,
            currency: tx.currency,
            date: tx.date,
            finalAccount: tx.finalAccount,
            finalVatCode: tx.finalVatCode,
            status: 'UNCATEGORIZED',
            integrationId: integration.id,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
        errors.push((err as Error).message);
      }
    }

    logger.info(`SIE4 import: ${imported} imported, ${skipped} skipped for org ${req.user!.organizationId}`);
    res.json({
      message: `Imported ${imported} transactions from SIE4 file.`,
      company: sie4Data.company,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (e) { next(e); }
});

// ============================================
// Fortnox OAuth
// ============================================

function fortnoxRedirectUri(): string {
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  return `${appUrl}/api/v1/integrations/fortnox/callback`;
}

// GET /api/v1/integrations/fortnox/authorize
// Redirects the user to Fortnox OAuth consent screen
router.get('/fortnox/authorize', async (req: AuthRequest, res) => {
  const orgId = req.user!.organizationId!;
  // State = hash of orgId so callback can verify it
  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url');
  const url = buildAuthorizeUrl(fortnoxRedirectUri(), state);
  res.redirect(url);
});

// GET /api/v1/integrations/fortnox/callback  (called by Fortnox — no auth middleware)
// Must be added BEFORE router.use(authenticate), so we define it on a separate mini-router
// below and mount it unauthenticated in server.ts via /api/v1/integrations-oauth
const oauthRouter = Router();
oauthRouter.get('/fortnox/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.APP_URL || 'http://localhost:5173';

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/integrations?error=fortnox_denied`);
  }

  let orgId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    orgId = decoded.orgId;
    if (!orgId) throw new Error('missing orgId');
  } catch {
    return res.redirect(`${frontendUrl}/integrations?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCode(code, fortnoxRedirectUri());

    await prisma.accountingIntegration.upsert({
      where: { organizationId_provider: { organizationId: orgId, provider: 'FORTNOX' } },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiry: tokens.expiresAt,
        status: 'ACTIVE',
        lastSyncAt: null,
      },
      create: {
        provider: 'FORTNOX',
        name: 'Fortnox',
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiry: tokens.expiresAt,
        organizationId: orgId,
        status: 'ACTIVE',
      },
    });

    logger.info(`Fortnox OAuth connected for org ${orgId}`);
    res.redirect(`${frontendUrl}/integrations?connected=fortnox`);
  } catch (err) {
    logger.error(`Fortnox OAuth callback error: ${(err as Error).message}`);
    res.redirect(`${frontendUrl}/integrations?error=fortnox_failed`);
  }
});

export { oauthRouter as fortnoxOAuthRouter };

// POST /api/v1/integrations/:id/sync - Manual sync trigger
router.post('/:id/sync', async (req: AuthRequest, res, next) => {
  try {
    const integration = await prisma.accountingIntegration.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!integration) return res.status(404).json({ error: 'Integration not found.' });
    if (integration.provider !== 'FORTNOX') return res.status(400).json({ error: 'Manual sync only supported for Fortnox.' });

    // Refresh token if needed
    let accessToken: string;
    const expirySoon = integration.tokenExpiry
      ? integration.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000
      : true;

    if (expirySoon && integration.refreshToken) {
      const tokens = await refreshAccessToken(integration.refreshToken);
      await prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: { accessToken: encrypt(tokens.accessToken), refreshToken: encrypt(tokens.refreshToken), tokenExpiry: tokens.expiresAt },
      });
      accessToken = tokens.accessToken;
    } else {
      accessToken = decrypt(integration.accessToken);
    }

    const client = await prisma.client.findFirst({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'asc' },
    });
    if (!client) return res.status(400).json({ error: 'No clients found. Create a client first.' });

    const fromDate = integration.lastSyncAt || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fortnox = new FortnoxClient(accessToken);
    const vouchers = await fortnox.fetchVouchers(fromDate);
    const mapped = mapVouchersToTransactions(vouchers, client.id, integration.id);

    let imported = 0;
    for (const tx of mapped) {
      await prisma.transaction.upsert({
        where: { clientId_externalId: { clientId: tx.clientId, externalId: tx.externalId } },
        update: {},
        create: tx,
      });
      imported++;
    }

    await prisma.accountingIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), status: 'ACTIVE' },
    });

    res.json({ message: `Sync complete. Imported ${imported} transactions.`, imported });
  } catch (e) { next(e); }
});

export { router as integrationRouter };