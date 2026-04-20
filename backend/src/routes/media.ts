import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';
import { processImage, uploadRawFile } from '../services/media-processor';
import { mediaQueue } from '../jobs/mediaWorker';
import { generateS3Key, uploadToS3 } from '../lib/s3';
import { db } from '../lib/db';
import type { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router: ExpressRouter = Router();
const UploadImageSchema = z.object({
  folder: z.enum(['thumbnails', 'banners', 'profiles']).default('thumbnails'),
});

// POST /api/media/image — upload image (thumbnail, banner, profile)
router.post(
  '/image',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const { folder } = UploadImageSchema.parse(req.body);
      const url = await processImage(req.file.buffer, req.file.originalname, folder, req.user!.id);
      res.json({ url });
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message ?? 'Upload failed' });
    }
  },
);

// POST /api/media/video — upload video (queues transcode)
router.post(
  '/video',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const key = generateS3Key('videos/original', req.file.originalname);
      const url = await uploadToS3(key, req.file.buffer, req.file.mimetype);

      const asset = await db.mediaAsset.create({
        data: {
          ownerId: req.user!.id,
          s3Key: key,
          cdnUrl: url,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: BigInt(req.file.size),
          isProcessed: false,
        },
      });

      await mediaQueue.add('transcode-video', {
        s3Key: key,
        assetId: asset.id,
        ownerId: req.user!.id,
        originalName: req.file.originalname,
      });

      res.json({ assetId: asset.id, originalUrl: url, status: 'processing' });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? 'Video upload failed' });
    }
  },
);

// POST /api/media/document — upload PDF or audio
router.post(
  '/document',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const folder = req.file.mimetype.startsWith('audio') ? 'audio' : 'documents';
      const url = await uploadRawFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folder,
        req.user!.id,
      );
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? 'Upload failed' });
    }
  },
);

// GET /api/media/status/:assetId — check processing status
router.get('/status/:assetId', requireAuth, async (req, res) => {
  try {
    const asset = await db.mediaAsset.findUnique({ where: { id: req.params.assetId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ assetId: asset.id, isProcessed: asset.isProcessed, cdnUrl: asset.cdnUrl });
  } catch {
    res.status(500).json({ error: 'Could not fetch asset status' });
  }
});

export default router;
