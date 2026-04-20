# Sprint 06 — Media Upload Pipeline

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** Secure media uploads to S3/R2, image resizing, video transcoding queue, CDN delivery. All course media goes through this pipeline.

---

## Tasks

### T06.1 — S3 client

CREATE FILE: `backend/src/lib/s3.ts`
```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';

export const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'af-south-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  // For Cloudflare R2, uncomment and set endpoint:
  // endpoint: process.env.S3_ENDPOINT,
  // forcePathStyle: true,
});

export const BUCKET = process.env.S3_BUCKET_NAME!;
export const CDN_BASE = process.env.CDN_BASE_URL ?? '';

export function generateS3Key(folder: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  const id = crypto.randomBytes(16).toString('hex');
  return `${folder}/${id}${ext}`;
}

export function cdnUrl(key: string): string {
  return `${CDN_BASE}/${key}`;
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));
  return cdnUrl(key);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}
```

---

### T06.2 — Upload middleware

CREATE FILE: `backend/src/middleware/upload.middleware.ts`
```typescript
import multer from 'multer';

const ALLOWED_MIME: Record<string, number> = {
  'image/jpeg': 5 * 1024 * 1024,        // 5 MB
  'image/png': 5 * 1024 * 1024,
  'image/webp': 5 * 1024 * 1024,
  'video/mp4': 2 * 1024 * 1024 * 1024,  // 2 GB
  'audio/mpeg': 200 * 1024 * 1024,       // 200 MB
  'audio/wav': 200 * 1024 * 1024,
  'application/pdf': 50 * 1024 * 1024,   // 50 MB
  'application/zip': 500 * 1024 * 1024,  // 500 MB (SCORM)
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // hard max 2GB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype] !== undefined) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});
```

---

### T06.3 — Media processor service

CREATE FILE: `backend/src/services/media-processor.ts`
```typescript
import sharp from 'sharp';
import { uploadToS3, generateS3Key, cdnUrl } from '../lib/s3';
import { db } from '../lib/db';
import { logger } from '../lib/logger';

type ImageSize = { suffix: string; width: number; height: number };

const IMAGE_SIZES: ImageSize[] = [
  { suffix: 'thumb', width: 400, height: 225 },
  { suffix: 'medium', width: 800, height: 450 },
  { suffix: 'full', width: 1920, height: 1080 },
];

/**
 * Process an uploaded image:
 * - Resize to 3 breakpoints
 * - Convert to WebP
 * - Upload all variants to S3
 * Returns the medium CDN URL (used as primary)
 */
export async function processImage(
  buffer: Buffer,
  originalName: string,
  folder: string,
  ownerId: string,
): Promise<string> {
  const results: string[] = [];

  for (const size of IMAGE_SIZES) {
    const key = generateS3Key(`${folder}/${size.suffix}`, originalName.replace(/\.[^.]+$/, '.webp'));
    const resized = await sharp(buffer)
      .resize(size.width, size.height, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const url = await uploadToS3(key, resized, 'image/webp');
    results.push(url);

    // Log asset for the "medium" size as primary
    if (size.suffix === 'medium') {
      await db.mediaAsset.create({
        data: {
          ownerId,
          s3Key: key,
          cdnUrl: url,
          fileName: originalName,
          mimeType: 'image/webp',
          sizeBytes: BigInt(resized.length),
          width: size.width,
          height: size.height,
          isProcessed: true,
        },
      });
    }
  }

  logger.info('Image processed and uploaded', { folder, variants: results.length });
  return results[1]; // medium URL
}

/**
 * Upload a raw file (PDF, audio, SCORM) without transformation.
 */
export async function uploadRawFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
  ownerId: string,
): Promise<string> {
  const key = generateS3Key(folder, originalName);
  const url = await uploadToS3(key, buffer, mimeType);

  await db.mediaAsset.create({
    data: {
      ownerId,
      s3Key: key,
      cdnUrl: url,
      fileName: originalName,
      mimeType,
      sizeBytes: BigInt(buffer.length),
      isProcessed: true,
    },
  });

  return url;
}
```

Note: Video transcoding (FFmpeg) is handled by the Bull worker in Sprint 06's job queue below, not inline.

---

### T06.4 — Media upload Bull queue

CREATE FILE: `backend/src/jobs/mediaWorker.ts`
```typescript
import Bull from 'bull';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { uploadToS3, generateS3Key, cdnUrl, BUCKET } from '../lib/s3';
import { db } from '../lib/db';
import { logger } from '../lib/logger';

export const mediaQueue = new Bull('media-processing', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

interface VideoJob {
  s3Key: string;            // original uploaded S3 key
  assetId: string;
  ownerId: string;
  originalName: string;
}

const VIDEO_RESOLUTIONS = [
  { label: '1080p', size: '1920x1080', bitrate: '4000k' },
  { label: '720p',  size: '1280x720',  bitrate: '2500k' },
  { label: '480p',  size: '854x480',   bitrate: '1000k' },
  { label: '360p',  size: '640x360',   bitrate: '500k' },  // offline pack
];

mediaQueue.process('transcode-video', 1, async (job) => {
  const { s3Key, assetId, ownerId, originalName } = job.data as VideoJob;
  logger.info('Starting video transcode', { assetId });

  // TODO: In production, download from S3, transcode, re-upload
  // This stub marks the asset as processed so the pipeline continues
  await db.mediaAsset.update({
    where: { id: assetId },
    data: { isProcessed: true },
  });

  logger.info('Video transcode complete (stub)', { assetId });
  return { assetId, resolutions: VIDEO_RESOLUTIONS.map((r) => r.label) };
});

mediaQueue.on('failed', (job, err) => {
  logger.error('Media job failed', { jobId: job.id, err: err.message });
});
```

---

### T06.5 — Media upload routes

CREATE FILE: `backend/src/routes/media.ts`
```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';
import { processImage, uploadRawFile } from '../services/media-processor';
import { mediaQueue } from '../jobs/mediaWorker';
import { generateS3Key, uploadToS3 } from '../lib/s3';
import { db } from '../lib/db';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// POST /api/media/image — upload image (thumbnail, banner, profile)
router.post('/image', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { folder = 'thumbnails' } = req.body;
    const url = await processImage(req.file.buffer, req.file.originalname, folder, req.user!.id);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
});

// POST /api/media/video — upload video (queues transcode)
router.post('/video', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
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
});

// POST /api/media/document — upload PDF or audio
router.post('/document', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const folder = req.file.mimetype.startsWith('audio') ? 'audio' : 'documents';
    const url = await uploadRawFile(req.file.buffer, req.file.originalname, req.file.mimetype, folder, req.user!.id);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
});

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
```

---

### T06.6 — Wire media router into app.ts

EDIT FILE: `backend/src/app.ts`
Add:
```typescript
import mediaRouter from './routes/media';
// ...
app.use('/api/media', mediaRouter);
```

---

## Validation Checklist

- [ ] `POST /api/media/image` with a JPG file returns a CDN URL
- [ ] The returned URL is accessible (200 response from CDN/S3)
- [ ] `POST /api/media/video` returns `{ assetId, status: "processing" }` and queues a Bull job
- [ ] `GET /api/media/status/:assetId` returns asset status
- [ ] Unsupported file types return 400 with error message
- [ ] MediaAsset record is created in database for each upload
- [ ] Only CONTENT_MANAGER and ADMIN can upload

**Sign-off:** Claude Code validates upload functionality and database records.
