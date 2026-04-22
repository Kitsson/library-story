import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { encrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

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

export { router as integrationRouter };