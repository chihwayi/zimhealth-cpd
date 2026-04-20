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
  s3Key: string; // original uploaded S3 key
  assetId: string;
  ownerId: string;
  originalName: string;
}

const VIDEO_RESOLUTIONS = [
  { label: '1080p', size: '1920x1080', bitrate: '4000k' },
  { label: '720p', size: '1280x720', bitrate: '2500k' },
  { label: '480p', size: '854x480', bitrate: '1000k' },
  { label: '360p', size: '640x360', bitrate: '500k' }, // offline pack
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

