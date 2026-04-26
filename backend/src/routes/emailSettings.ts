import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { testSmtpConnection } from '../services/email';

const router = Router();
router.use(authenticate);

const smtpSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpFrom: z.string().email(),
  smtpFromName: z.string().min(1),
  smtpSecure: z.boolean().default(true),
  emailNotifyOnUpload: z.boolean().default(true),
});

// GET /api/v1/email-settings
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: {
        smtpHost: true, smtpPort: true, smtpUser: true,
        smtpFrom: true, smtpFromName: true, smtpSecure: true,
        emailNotifyOnUpload: true,
      },
    });

    res.json({
      configured: !!org?.smtpHost,
      settings: {
        smtpHost: org?.smtpHost || '',
        smtpPort: org?.smtpPort || 587,
        smtpUser: org?.smtpUser || '',
        smtpPass: '',  // never return password
        smtpFrom: org?.smtpFrom || '',
        smtpFromName: org?.smtpFromName || '',
        smtpSecure: org?.smtpSecure ?? true,
        emailNotifyOnUpload: org?.emailNotifyOnUpload ?? true,
      },
    });
  } catch (e) { next(e); }
});

// PATCH /api/v1/email-settings
router.patch('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const data = smtpSchema.parse(req.body);
    await prisma.organization.update({
      where: { id: req.user!.organizationId! },
      data: {
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        smtpPass: data.smtpPass,
        smtpFrom: data.smtpFrom,
        smtpFromName: data.smtpFromName,
        smtpSecure: data.smtpSecure,
        emailNotifyOnUpload: data.emailNotifyOnUpload,
      },
    });
    res.json({ message: 'Email settings saved.' });
  } catch (e) { next(e); }
});

// POST /api/v1/email-settings/test
router.post('/test', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true },
    });

    if (!org?.smtpHost) return res.status(400).json({ error: 'Email not configured yet.' });

    await testSmtpConnection({
      host: org.smtpHost,
      port: org.smtpPort!,
      secure: org.smtpSecure,
      user: org.smtpUser!,
      pass: org.smtpPass!,
      from: org.smtpFrom!,
      fromName: org.smtpFromName!,
    });

    res.json({ message: 'Connection successful! Your email settings are working.' });
  } catch (e: any) {
    res.status(400).json({ error: `Connection failed: ${e.message}` });
  }
});

export { router as emailSettingsRouter };
