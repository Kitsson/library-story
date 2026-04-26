import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { sendUploadNotificationEmail } from '../services/email';
import { buildCfg } from './emailSettings';
import { supabase, BUCKET } from '../utils/supabase';

const router = Router();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.doc', '.docx', '.xls', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) cb(null, true);
  else cb(new Error(`File type not allowed: ${ext}`));
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
});

async function uploadToSupabase(file: Express.Multer.File, folder: string): Promise<string> {
  const ext = path.extname(file.originalname);
  const storagePath = `${folder}/${uuidv4()}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return storagePath;
}

// POST /api/v1/uploads - Upload file (auth required)
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required.' });

    const storagePath = await uploadToSupabase(req.file, `org-${req.user!.organizationId}/client-${clientId}`);

    const uploadRecord = await prisma.upload.create({
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: storagePath,
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
      include: {
        client: { select: { name: true } },
        requester: { select: { firstName: true, lastName: true, organizationId: true } },
      },
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

// POST /api/v1/uploads/portal/:token - Public upload via token (no auth)
router.post('/portal/:token', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    const docRequest = await prisma.documentRequest.findUnique({
      where: { uploadToken: req.params.token },
      include: { client: true },
    });

    if (!docRequest) return res.status(404).json({ error: 'Invalid upload link.' });
    if (docRequest.tokenExpiry && docRequest.tokenExpiry < new Date()) {
      return res.status(410).json({ error: 'Upload link has expired.' });
    }

    // Upload to Supabase Storage
    const storagePath = await uploadToSupabase(
      req.file,
      `requests/${docRequest.id}`
    );

    const uploadRecord = await prisma.upload.create({
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: storagePath,
        clientId: docRequest.clientId,
        requestId: docRequest.id,
        source: 'portal',
        ipAddress: req.ip,
      },
    });

    // Mark next unuploaded item as done, update completion
    try {
      const items = JSON.parse(docRequest.items as string);
      for (const item of items) {
        if (!item.uploaded) { item.uploaded = true; break; }
      }
      const uploadedCount = items.filter((i: any) => i.uploaded).length;
      const allUploaded = items.every((i: any) => i.uploaded || !i.required);
      await prisma.documentRequest.update({
        where: { id: docRequest.id },
        data: {
          items: JSON.stringify(items),
          status: allUploaded ? 'COMPLETED' : 'PARTIAL',
          completionRate: uploadedCount / items.length,
          completedAt: allUploaded ? new Date() : null,
        },
      });
    } catch {}

    // Notify accountant
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
          const appUrl = process.env.APP_URL || 'https://klaryproject-mu.vercel.app';
          await sendUploadNotificationEmail(buildCfg(org), {
            accountantEmail: requester.email,
            accountantName: `${requester.firstName} ${requester.lastName}`,
            firmName: org.name,
            clientName: docRequest.client.name,
            requestTitle: docRequest.title,
            fileName: req.file!.originalname,
            uploadedAt: new Date().toLocaleString('sv-SE'),
            requestUrl: `${appUrl}/documents`,
          });
        }
      }
    } catch (notifyErr: any) {
      logger.warn(`Upload notification failed: ${notifyErr.message}`);
    }

    logger.info(`Portal upload: ${req.file!.originalname} → Supabase ${storagePath}`);
    res.status(201).json({ message: 'File uploaded successfully!', upload: uploadRecord });
  } catch (e) { next(e); }
});

export { router as uploadRouter };
