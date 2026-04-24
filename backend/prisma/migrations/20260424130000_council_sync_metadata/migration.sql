-- AlterTable
ALTER TABLE "CPDRecord" ADD COLUMN "nczSyncMetadata" JSONB;
ALTER TABLE "CPDRecord" ADD COLUMN "nczIdempotencyKey" TEXT;

-- CreateIndex
CREATE INDEX "CPDRecord_nczIdempotencyKey_idx" ON "CPDRecord"("nczIdempotencyKey");
-- AlterTable
ALTER TABLE "CPDRecord" ADD COLUMN "nczNextRetryAt" TIMESTAMP(3);
