import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { sendUploadNotificationEmail } from '../services/email';
import { buildCfg } from './emailSettings';

const router = Router();

const uploadDir = process.env.UPLOAD_PATH || '/tmp/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.doc', '.docx', '.xls', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${ext}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') }, // 10MB
});

// POST /api/v1/uploads - Upload file (auth required)
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required.' });

    const uploadRecord = await prisma.upload.create({
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.filename,
        clientId,
        source: 'portal',
        ipAddress: req.ip,
      },
    });

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes) for client ${clientId}`);
    res.status(201).json({ message: 'File uploaded.', upload: uploadRecord });
  } catch (e) { next(e); }
});

// GET /api/v1/uploads/portal/:token - Public: get request details by token
router.get('/portal/:token', async (req, res, next) => {
  try {
    const docRequest = await prisma.documentRequest.findUnique({
      where: { uploadToken: req.params.token },
      include: { client: { select: { name: true } }, requester: { select: { firstName: true, lastName: true, organizationId: true } } },
    });

    if (!docRequest) return res.status(404).json({ error: 'Invalid upload link.' });
    if (docRequest.tokenExpiry && docRequest.tokenExpiry < new Date()) {
      return res.status(410).json({ error: 'This upload link has expired. Please contact your accountant for a new one.' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: docRequest.requester.organizationId! },
      select: { name: true },
    });

    res.json({
      title: docRequest.title,
      description: docRequest.description,
      firmName: org?.name || 'Your accountant',
      clientName: docRequest.client.name,
      items: JSON.parse(docRequest.items as string),
      status: docRequest.status,
      dueDate: docRequest.dueDate,
    });
  } catch (e) { next(e); }
});

// POST /portal/upload/:token - Public upload via token (no auth)
router.post('/portal/:token', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    // Verify token
    const docRequest = await prisma.documentRequest.findUnique({
      where: { uploadToken: req.params.token },
      include: { client: true },
    });

    if (!docRequest) return res.status(404).json({ error: 'Invalid upload link.' });
    if (docRequest.tokenExpiry && docRequest.tokenExpiry < new Date()) {
      return res.status(410).json({ error: 'Upload link has expired.' });
    }

    const uploadRecord = await prisma.upload.create({
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.filename,
        clientId: docRequest.clientId,
        requestId: docRequest.id,
        source: 'portal',
        ipAddress: req.ip,
      },
    });

    // Update document request items
    try {
      const items = JSON.parse(docRequest.items as string);
      for (const item of items) {
        if (!item.uploaded) { item.uploaded = true; break; }
      }
      const allUploaded = items.every((i: any) => i.uploaded || !i.required);
      await prisma.documentRequest.update({
        where: { id: docRequest.id },
        data: {
          items: JSON.stringify(items),
          status: allUploaded ? 'COMPLETED' : 'PARTIAL',
          completionRate: items.filter((i: any) => i.uploaded).length / items.length,
          completedAt: allUploaded ? new Date() : null,
        },
      });
    } catch {}

    // Notify accountant by email if configured
    try {
      const requester = await prisma.user.findUnique({
        where: { id: docRequest.requestedBy },
        select: { email: true, firstName: true, lastName: true, organizationId: true },
      });

      if (requester?.organizationId) {
        const org = await prisma.organization.findUnique({
          where: { id: requester.organizationId },
          select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true, resendApiKey: true, emailNotifyOnUpload: true, name: true },
        });

        const emailReady = org && (org.resendApiKey || org.smtpHost);
        if (emailReady && org.emailNotifyOnUpload) {
          const appUrl = process.env.APP_URL || 'https://klaryproject.vercel.app';
          await sendUploadNotificationEmail(
            buildCfg(org),
            {
              accountantEmail: requester.email,
              accountantName: `${requester.firstName} ${requester.lastName}`,
              firmName: org.name,
              clientName: docRequest.client.name,
              requestTitle: docRequest.title,
              fileName: req.file!.originalname,
              uploadedAt: new Date().toLocaleString('sv-SE'),
              requestUrl: `${appUrl}/document-requests`,
            }
          );
        }
      }
    } catch (notifyErr: any) {
      logger.warn(`Upload notification failed: ${notifyErr.message}`);
    }

    logger.info(`Portal upload: ${req.file!.originalname} for request ${docRequest.id}`);
    res.status(201).json({ message: 'File uploaded successfully!', upload: uploadRecord });
  } catch (e) { next(e); }
});

export { router as uploadRouter };