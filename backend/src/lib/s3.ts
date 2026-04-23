import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';

export const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'af-south-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
  ...(process.env.S3_ENDPOINT
    ? {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
});

export const BUCKET = process.env.S3_BUCKET_NAME;
export const CDN_BASE = process.env.CDN_BASE_URL ?? '';

export function isS3Configured(): boolean {
  return Boolean(process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function generateS3Key(folder: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  const id = crypto.randomBytes(16).toString('hex');
  return `${folder}/${id}${ext}`;
}

export function cdnUrl(key: string): string {
  if (!CDN_BASE) return key;
  return `${CDN_BASE.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!BUCKET || !isS3Configured()) {
    throw new Error('S3 is not configured. Set S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (and optionally CDN_BASE_URL).');
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    }),
  );
  return cdnUrl(key);
}

export async function deleteFromS3(key: string): Promise<void> {
  if (!BUCKET || !isS3Configured()) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  if (!BUCKET || !isS3Configured()) {
    throw new Error('S3 is not configured. Cannot sign download URLs.');
  }
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  if (!BUCKET || !isS3Configured()) {
    throw new Error('S3 is not configured. Cannot download objects.');
  }

  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!response.Body) {
    throw new Error(`S3 object "${key}" has no body.`);
  }

  if (typeof response.Body.transformToByteArray === 'function') {
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];
  const readable = response.Body as Readable;

  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
