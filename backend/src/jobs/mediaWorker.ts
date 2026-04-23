import Bull from 'bull';
import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { MediaAssetStatus } from '@prisma/client';
import { uploadToS3, generateS3Key, downloadFromS3 } from '../lib/s3';
import { db } from '../lib/db';
import { logger } from '../lib/logger';

const ffmpegPath = process.env.FFMPEG_PATH;
const ffprobePath = process.env.FFPROBE_PATH;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

export const mediaQueue = new Bull('media-processing', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

interface VideoJob {
  s3Key: string;
  assetId: string;
  ownerId: string;
  originalName: string;
}

interface OfficeJob {
  s3Key: string;
  assetId: string;
  ownerId: string;
  originalName: string;
}

type ProbeMetadata = {
  durationSecs: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
};

type UploadedVariant = {
  label: string;
  width: number | null;
  height: number | null;
  bitrate: string;
  s3Key: string;
  cdnUrl: string;
};

const VIDEO_PRESETS = [
  { label: '720p', size: '1280x720', width: 1280, height: 720, bitrate: '2500k' },
  { label: '480p', size: '854x480', width: 854, height: 480, bitrate: '1000k' },
  { label: '360p', size: '640x360', width: 640, height: 360, bitrate: '500k' },
] as const;

const DEFAULT_ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

function getMediaConcurrency(): number {
  const value = Number(process.env.MEDIA_PROCESSING_CONCURRENCY ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function getMaxDurationSeconds(): number {
  const value = Number(process.env.MEDIA_MAX_DURATION_SECONDS ?? 7200);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 7200;
}

function getThumbnailSecond(durationSecs: number | null): number {
  const configured = Number(process.env.MEDIA_THUMBNAIL_AT_SECONDS ?? 5);
  const fallback = Number.isFinite(configured) && configured >= 0 ? configured : 5;
  if (!durationSecs || durationSecs <= 1) return 0;
  return Math.max(0, Math.min(fallback, Math.max(durationSecs - 1, 0)));
}

function getVideoMimeAllowList(): string[] {
  const raw = process.env.MEDIA_ALLOWED_VIDEO_MIME_TYPES?.trim();
  if (!raw) return DEFAULT_ALLOWED_VIDEO_MIME_TYPES;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldGenerateVariant(width: number | null, height: number | null, variant: (typeof VIDEO_PRESETS)[number]): boolean {
  if (!width || !height) return true;
  return width >= variant.width && height >= variant.height;
}

async function ensureTempDir(assetId: string): Promise<string> {
  const tempDir = process.env.MEDIA_TEMP_DIR ?? os.tmpdir();
  const dir = path.join(tempDir, `zimhealth-media-${assetId}-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupTempDir(dir: string | null): Promise<void> {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true });
}

function probeVideo(filePath: string): Promise<ProbeMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');
      const audioStream = metadata.streams.find((stream) => stream.codec_type === 'audio');
      resolve({
        durationSecs: metadata.format.duration ? Math.round(metadata.format.duration) : null,
        width: typeof videoStream?.width === 'number' ? videoStream.width : null,
        height: typeof videoStream?.height === 'number' ? videoStream.height : null,
        videoCodec: typeof videoStream?.codec_name === 'string' ? videoStream.codec_name : null,
        audioCodec: typeof audioStream?.codec_name === 'string' ? audioStream.codec_name : null,
      });
    });
  });
}

function transcodeVariant(inputPath: string, outputPath: string, variant: (typeof VIDEO_PRESETS)[number]): Promise<void> {
  const preset = process.env.MEDIA_TRANSCODE_PRESET ?? 'veryfast';

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(variant.size)
      .outputOptions([
        '-preset', preset,
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'main',
        '-level', '4.0',
        '-b:v', variant.bitrate,
        '-maxrate', variant.bitrate,
        '-bufsize', `${Number.parseInt(variant.bitrate, 10) * 2 || 2000}k`,
        '-ac', '2',
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

function generateThumbnail(inputPath: string, outputPath: string, timestampSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .screenshots({
        count: 1,
        folder: path.dirname(outputPath),
        filename: path.basename(outputPath),
        timemarks: [`${timestampSeconds}`],
        size: '1280x?',
      });
  });
}

async function updateAssetStatus(assetId: string, status: MediaAssetStatus, extra: Record<string, unknown> = {}) {
  await db.mediaAsset.update({
    where: { id: assetId },
    data: {
      status,
      isProcessed: status === 'PROCESSED',
      ...extra,
    },
  });
}

mediaQueue.process('transcode-video', getMediaConcurrency(), async (job) => {
  const startedAt = Date.now();
  const { s3Key, assetId, originalName } = job.data as VideoJob;
  let tempDir: string | null = null;

  await updateAssetStatus(assetId, 'PROCESSING', {
    processingError: null,
    processingStartedAt: new Date(),
    processingAttempts: { increment: 1 },
  });

  logger.info('Starting video transcode', { assetId, jobId: job.id, s3Key });

  try {
    const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Media asset not found');

    const allowedMimeTypes = getVideoMimeAllowList();
    if (!allowedMimeTypes.includes(asset.mimeType)) {
      throw new Error(`Unsupported video type: ${asset.mimeType}`);
    }

    tempDir = await ensureTempDir(assetId);
    const inputExtension = path.extname(originalName) || '.mp4';
    const inputPath = path.join(tempDir, `source${inputExtension}`);

    const originalBuffer = await downloadFromS3(s3Key);
    await fs.writeFile(inputPath, originalBuffer);

    const metadata = await probeVideo(inputPath);
    if (!metadata.durationSecs || metadata.durationSecs <= 0) {
      throw new Error('Could not determine video duration');
    }
    if (metadata.durationSecs > getMaxDurationSeconds()) {
      throw new Error(`Video exceeds max duration of ${getMaxDurationSeconds()} seconds`);
    }

    const enabledMultiResolution = (process.env.MEDIA_ENABLE_MULTI_RESOLUTION ?? 'true').toLowerCase() !== 'false';
    const variantsToGenerate = (enabledMultiResolution ? VIDEO_PRESETS : [VIDEO_PRESETS[0]]).filter((variant) =>
      shouldGenerateVariant(metadata.width, metadata.height, variant),
    );
    const fallbackVariant = variantsToGenerate[0] ?? VIDEO_PRESETS[VIDEO_PRESETS.length - 1];

    const uploadedVariants: UploadedVariant[] = [];

    for (const variant of variantsToGenerate.length ? variantsToGenerate : [fallbackVariant]) {
      const outputFileName = `${path.parse(originalName).name}-${variant.label}.mp4`;
      const outputPath = path.join(tempDir, outputFileName);
      await transcodeVariant(inputPath, outputPath, variant);
      const buffer = await fs.readFile(outputPath);
      const processedS3Key = generateS3Key('videos/processed', outputFileName);
      const processedCdnUrl = await uploadToS3(processedS3Key, buffer, 'video/mp4');

      uploadedVariants.push({
        label: variant.label,
        width: variant.width,
        height: variant.height,
        bitrate: variant.bitrate,
        s3Key: processedS3Key,
        cdnUrl: processedCdnUrl,
      });
    }

    const primaryVariant = uploadedVariants[0];
    if (!primaryVariant) {
      throw new Error('No processed video variants were generated');
    }

    const thumbnailPath = path.join(tempDir, `${path.parse(originalName).name}-thumbnail.jpg`);
    await generateThumbnail(inputPath, thumbnailPath, getThumbnailSecond(metadata.durationSecs));
    const thumbnailBuffer = await fs.readFile(thumbnailPath);
    const thumbnailS3Key = generateS3Key('videos/thumbnails', `${path.parse(originalName).name}.jpg`);
    const thumbnailCdnUrl = await uploadToS3(thumbnailS3Key, thumbnailBuffer, 'image/jpeg');

    await updateAssetStatus(assetId, 'PROCESSED', {
      cdnUrl: primaryVariant.cdnUrl,
      processedS3Key: primaryVariant.s3Key,
      processedCdnUrl: primaryVariant.cdnUrl,
      thumbnailS3Key,
      thumbnailCdnUrl,
      width: metadata.width,
      height: metadata.height,
      durationSecs: metadata.durationSecs,
      processedAt: new Date(),
      processingError: null,
      variants: {
        source: {
          width: metadata.width,
          height: metadata.height,
          durationSecs: metadata.durationSecs,
          videoCodec: metadata.videoCodec,
          audioCodec: metadata.audioCodec,
        },
        outputs: uploadedVariants,
      },
    });

    logger.info('Video transcode complete', {
      assetId,
      jobId: job.id,
      elapsedMs: Date.now() - startedAt,
      variants: uploadedVariants.map((variant) => variant.label),
    });

    return {
      assetId,
      durationSecs: metadata.durationSecs,
      variants: uploadedVariants.map((variant) => variant.label),
      thumbnailCdnUrl,
    };
  } catch (error) {
    const err = error as Error;
    await updateAssetStatus(assetId, 'FAILED', {
      processingError: err.message,
    }).catch(() => undefined);

    logger.error('Media job failed', {
      assetId,
      jobId: job.id,
      elapsedMs: Date.now() - startedAt,
      err: err.message,
    });
    throw err;
  } finally {
    await cleanupTempDir(tempDir).catch((cleanupError) => {
      logger.warn('Could not clean media temp directory', { assetId, error: (cleanupError as Error).message });
    });
  }
});

function execFilePromise(cmd: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<void>((resolve, reject) => {
    execFile(cmd, args, { ...options }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}${stderr ? `\n${stderr}` : ''}`));
        return;
      }
      resolve();
    });
  });
}

mediaQueue.process('convert-office-to-pdf', getMediaConcurrency(), async (job) => {
  const startedAt = Date.now();
  const { s3Key, assetId, originalName } = job.data as OfficeJob;
  let tempDir: string | null = null;

  await updateAssetStatus(assetId, 'PROCESSING', {
    processingError: null,
    processingStartedAt: new Date(),
    processingAttempts: { increment: 1 },
  });

  logger.info('Starting office-to-pdf conversion', { assetId, jobId: job.id, s3Key });

  try {
    const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Media asset not found');

    tempDir = await ensureTempDir(assetId);
    const inputExt = path.extname(originalName) || '.bin';
    const inputPath = path.join(tempDir, `source${inputExt}`);
    const inputBuffer = await downloadFromS3(s3Key);
    await fs.writeFile(inputPath, inputBuffer);

    const soffice = process.env.LIBREOFFICE_PATH ?? 'soffice';
    await execFilePromise(soffice, ['--headless', '--nologo', '--nolockcheck', '--convert-to', 'pdf', '--outdir', tempDir, inputPath]);

    const baseName = path.parse(inputPath).name;
    const outputPath = path.join(tempDir, `${baseName}.pdf`);
    const pdf = await fs.readFile(outputPath);

    const pdfFileName = `${path.parse(originalName).name}.pdf`;
    const processedS3Key = generateS3Key('documents/processed', pdfFileName);
    const processedCdnUrl = await uploadToS3(processedS3Key, pdf, 'application/pdf');

    await updateAssetStatus(assetId, 'PROCESSED', {
      processedS3Key,
      processedCdnUrl,
      processedAt: new Date(),
      processingError: null,
      variants: {
        source: { mimeType: asset.mimeType, originalName },
        outputs: [{ label: 'pdf', s3Key: processedS3Key, cdnUrl: processedCdnUrl }],
      },
    });

    logger.info('Office conversion complete', {
      assetId,
      jobId: job.id,
      elapsedMs: Date.now() - startedAt,
      processedS3Key,
    });

    return { assetId, processedCdnUrl };
  } catch (error) {
    const err = error as Error;
    await updateAssetStatus(assetId, 'FAILED', { processingError: err.message }).catch(() => undefined);
    logger.error('Office conversion failed', {
      assetId,
      jobId: job.id,
      elapsedMs: Date.now() - startedAt,
      err: err.message,
    });
    throw err;
  } finally {
    await cleanupTempDir(tempDir).catch((cleanupError) => {
      logger.warn('Could not clean media temp directory', { assetId, error: (cleanupError as Error).message });
    });
  }
});

mediaQueue.on('failed', (job, err) => {
  logger.error('Media queue failed event', {
    jobId: job.id,
    assetId: (job.data as VideoJob | undefined)?.assetId,
    err: err.message,
  });
});
