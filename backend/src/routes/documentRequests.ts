import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateToken } from '../utils/crypto';
import { logger } from '../utils/logger';
import { sendDocumentRequestEmail } from '../services/email';
import { buildCfg } from './emailSettings';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  templateType: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    required: z.boolean().default(true),
  })).default([]),
  channel: z.enum(['sms', 'email', 'portal']).default('sms'),
  dueDate: z.preprocess(val => (val === '' || val === null) ? undefined : val, z.string().datetime().optional()),
});

// GET /api/v1/document-requests
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, clientId, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { organizationId: orgId };
    if (status) where.status = status as string;
    if (clientId) where.clientId = clientId as string;

    const [requests, total] = await Promise.all([
      prisma.documentRequest.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, name: true, phone: true, email: true } } },
      }),
      prisma.documentRequest.count({ where }),
    ]);

    res.json({ requests, total });
  } catch (e) { next(e); }
});

// POST /api/v1/document-requests - Create and send
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId: orgId },
    });
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    // Generate secure upload token (24h expiry)
    const uploadToken = generateToken(32);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create request
    const request = await prisma.documentRequest.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        description: data.description,
        templateType: data.templateType,
        items: JSON.stringify(data.items.map(i => ({ ...i, uploaded: false }))),
        channel: data.channel,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        requestedBy: req.user!.id,
        organizationId: orgId,
        uploadToken,
        tokenExpiry,
        status: 'DRAFT',
      },
      include: { client: { select: { id: true, name: true, phone: true, email: true } } },
    });

    // Auto-send if SMS channel (Twilio placeholder)
    if (data.channel === 'sms') {
      await prisma.documentRequest.update({
        where: { id: request.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      logger.info(`Document request marked sent via SMS to ${client.name}`);
    }

    // Send email if email channel
    if (data.channel === 'email') {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true, resendApiKey: true, name: true },
      });

      const emailReady = org && (org.resendApiKey || org.smtpHost);
      if (emailReady && client.email) {
        try {
          const appUrl = process.env.APP_URL || 'https://klaryproject.vercel.app';
          const uploadUrl = `${appUrl}/portal/upload/${uploadToken}`;
          const items = data.items.map(i => ({ name: i.name, required: i.required }));

          await sendDocumentRequestEmail(
            buildCfg(org),
            {
              clientName: client.name,
              clientEmail: client.email,
              firmName: org.name,
              requestTitle: data.title,
              requestDescription: data.description,
              items,
              uploadUrl,
              dueDate: data.dueDate ? new Date(data.dueDate).toLocaleDateString('sv-SE') : undefined,
            }
          );

          await prisma.documentRequest.update({
            where: { id: request.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        } catch (emailErr: any) {
          logger.error(`Failed to send document request email: ${emailErr.message}`);
        }
      } else if (!client.email) {
        logger.warn(`Cannot send email for document request ${request.id}: client has no email address`);
      } else {
        logger.warn(`Cannot send email for document request ${request.id}: SMTP not configured`);
      }
    }

    res.status(201).json({
      message: 'Document request created.',
      request: { ...request, uploadUrl: `/portal/upload/${uploadToken}` },
    });
  } catch (e) { next(e); }
});

// POST /api/v1/document-requests/:id/send-reminder
router.post('/:id/send-reminder', async (req: AuthRequest, res, next) => {
  try {
    const request = await prisma.documentRequest.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { client: true },
    });
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    await prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        remindersSent: { increment: 1 },
        lastRemindedAt: new Date(),
      },
    });

    logger.info(`Reminder sent for document request ${request.id}`);
    res.json({ message: 'Reminder sent.' });
  } catch (e) { next(e); }
});

// GET /api/v1/document-requests/templates
router.get('/templates/list', async (_req: AuthRequest, res, next) => {
  try {
    const templates = [
      { id: 'momsredovisning', name: 'Momsredovisning (VAT Return)', description: 'Quarterly VAT submission documents', items: [
        { name: 'Försäljningsfakturor', description: 'All sales invoices for the period', required: true },
        { name: 'Inköpskvitton', description: 'Purchase receipts', required: true },
        { name: 'Kontoutdrag', description: 'Bank statements', required: true },
      ]},
      { id: 'arsbokslut', name: 'Årsbokslut (Year-End)', description: 'Annual closing documents', items: [
        { name: 'Inventeringslista', description: 'Inventory list', required: true },
        { name: 'Avstämningsbilagor', description: 'Reconciliation documents', required: true },
        { name: 'Lönebesked', description: 'Payroll statements', required: true },
        { name: 'Skuldebrev', description: 'Loan documents', required: false },
      ]},
      { id: 'loneunderlag', name: 'Löneunderlag (Payroll)', description: 'Monthly payroll data', items: [
        { name: 'Tidrapport', description: 'Timesheets', required: true },
        { name: 'Reseräkningar', description: 'Expense reports', required: true },
        { name: 'Frånvaro', description: 'Absence records', required: true },
      ]},
    ];
    res.json({ templates });
  } catch (e) { next(e); }
});

export { router as documentRequestRouter };