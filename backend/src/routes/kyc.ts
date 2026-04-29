import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const DEFAULT_CHECKLIST = [
  { item: 'Identifiering av kund', description: 'Kontrollera identitetshandling (pass, körkort)', required: true, completed: false },
  { item: 'Ägarstruktur', description: 'Kartlägg verkliga huvudmän och ägare > 25%', required: true, completed: false },
  { item: 'Källa till medel', description: 'Dokumentera varifrån kundens medel härstammar', required: true, completed: false },
  { item: 'Affärsrelationens syfte', description: 'Beskriv syftet med affärsrelationen', required: true, completed: false },
  { item: 'PEP-kontroll', description: 'Kontrollera om kund är politiskt exponerad person', required: true, completed: false },
  { item: 'Sanktionslista', description: 'Kontrollera mot EU/FN sanktionslistor', required: true, completed: false },
  { item: 'Riskbedömning', description: 'Genomför samlad riskbedömning baserat på ovanstående', required: true, completed: false },
];

// GET /api/v1/kyc/:clientId
router.get('/:clientId', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const client = await prisma.client.findFirst({
      where: { id: req.params.clientId, organizationId: orgId },
      select: { id: true, name: true, kycStatus: true, kycRiskLevel: true, kycNotes: true, kycVerifiedAt: true, kycChecklist: true },
    });
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    // Return default checklist if none saved yet
    const checklist = (client.kycChecklist as any[]) || DEFAULT_CHECKLIST;
    res.json({ ...client, kycChecklist: checklist });
  } catch (e) { next(e); }
});

// PATCH /api/v1/kyc/:clientId
router.patch('/:clientId', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const schema = z.object({
      kycStatus: z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
      kycRiskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      kycNotes: z.string().max(2000).optional(),
      kycChecklist: z.array(z.object({
        item: z.string(),
        description: z.string().optional(),
        required: z.boolean(),
        completed: z.boolean(),
        notes: z.string().optional(),
      })).optional(),
    });
    const data = schema.parse(req.body);

    const updateData: any = { ...data };
    if (data.kycStatus === 'APPROVED') updateData.kycVerifiedAt = new Date();
    if (data.kycStatus && data.kycStatus !== 'APPROVED') updateData.kycVerifiedAt = null;

    const updated = await prisma.client.updateMany({
      where: { id: req.params.clientId, organizationId: orgId },
      data: updateData,
    });

    if (updated.count === 0) return res.status(404).json({ error: 'Client not found.' });
    res.json({ message: 'KYC updated.' });
  } catch (e) { next(e); }
});

export { router as kycRouter };
