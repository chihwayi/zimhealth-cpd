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
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

