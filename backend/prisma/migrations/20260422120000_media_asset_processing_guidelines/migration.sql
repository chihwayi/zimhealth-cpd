-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "MediaAsset"
ADD COLUMN "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN "processedS3Key" TEXT,
ADD COLUMN "processedCdnUrl" TEXT,
ADD COLUMN "thumbnailS3Key" TEXT,
ADD COLUMN "thumbnailCdnUrl" TEXT,
ADD COLUMN "processingError" TEXT,
ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "variants" JSONB;

UPDATE "MediaAsset"
SET
  "status" = CASE WHEN "isProcessed" = true THEN 'PROCESSED'::"MediaAssetStatus" ELSE 'UPLOADED'::"MediaAssetStatus" END,
  "processedS3Key" = CASE WHEN "isProcessed" = true THEN "s3Key" ELSE NULL END,
  "processedCdnUrl" = CASE WHEN "isProcessed" = true THEN "cdnUrl" ELSE NULL END,
  "processedAt" = CASE WHEN "isProcessed" = true THEN "createdAt" ELSE NULL END;

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_createdAt_idx" ON "MediaAsset"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");
