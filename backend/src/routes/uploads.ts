import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const uploadDir = process.env.UPLOAD_PATH || './uploads';

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
      // Mark first unuploaded item as uploaded
      for (const item of items) {
        if (!item.uploaded) {
          item.uploaded = true;
          break;
        }
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

    logger.info(`Portal upload: ${req.file.originalname} for request ${docRequest.id}`);
    res.status(201).json({ message: 'File uploaded successfully!', upload: uploadRecord });
  } catch (e) { next(e); }
});

export { router as uploadRouter };