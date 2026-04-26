import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { testSmtpConnection } from '../services/email';

const router = Router();
router.use(authenticate);

const settingsSchema = z.object({
  // Resend (API-based, works everywhere)
  resendApiKey: z.string().optional(),
  // SMTP (self-hosted / corporate email)
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email(),
  smtpFromName: z.string().min(1),
  smtpSecure: z.boolean().default(true),
  emailNotifyOnUpload: z.boolean().default(true),
});

function buildCfg(org: any) {
  return {
    resendApiKey: org.resendApiKey || undefined,
    host: org.smtpHost || undefined,
    port: org.smtpPort || undefined,
    secure: org.smtpSecure,
    user: org.smtpUser || undefined,
    pass: org.smtpPass || undefined,
    from: org.smtpFrom!,
    fromName: org.smtpFromName!,
  };
}

// GET /api/v1/email-settings
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: {
        smtpHost: true, smtpPort: true, smtpUser: true,
        smtpFrom: true, smtpFromName: true, smtpSecure: true,
        resendApiKey: true, emailNotifyOnUpload: true,
      },
    });

    const hasResend = !!org?.resendApiKey;
    const hasSmtp = !!org?.smtpHost;

    res.json({
      configured: hasResend || hasSmtp,
      provider: hasResend ? 'resend' : hasSmtp ? 'smtp' : 'none',
      settings: {
        resendApiKey: org?.resendApiKey ? '***' : '',
        smtpHost: org?.smtpHost || '',
        smtpPort: org?.smtpPort || 587,
        smtpUser: org?.smtpUser || '',
        smtpPass: '',
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
    const data = settingsSchema.parse(req.body);

    const updateData: any = {
      smtpFrom: data.smtpFrom,
      smtpFromName: data.smtpFromName,
      smtpSecure: data.smtpSecure,
      emailNotifyOnUpload: data.emailNotifyOnUpload,
    };

    if (data.resendApiKey) updateData.resendApiKey = data.resendApiKey;
    if (data.smtpHost) updateData.smtpHost = data.smtpHost;
    if (data.smtpPort) updateData.smtpPort = data.smtpPort;
    if (data.smtpUser) updateData.smtpUser = data.smtpUser;
    if (data.smtpPass) updateData.smtpPass = data.smtpPass;

    await prisma.organization.update({
      where: { id: req.user!.organizationId! },
      data: updateData,
    });

    res.json({ message: 'Email settings saved.' });
  } catch (e) { next(e); }
});

// POST /api/v1/email-settings/test
router.post('/test', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true, resendApiKey: true },
    });

    if (!org?.resendApiKey && !org?.smtpHost) {
      return res.status(400).json({ error: 'Email not configured yet.' });
    }

    await testSmtpConnection(buildCfg(org));
    res.json({ message: 'Connection successful! Your email settings are working.' });
  } catch (e: any) {
    res.status(400).json({ error: `Connection failed: ${e.message}` });
  }
});

export { router as emailSettingsRouter };
export { buildCfg };
