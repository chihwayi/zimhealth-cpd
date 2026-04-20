import sharp from 'sharp';
import { uploadToS3, generateS3Key } from '../lib/s3';
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

