-- AlterTable
ALTER TABLE "CPDRecord" ADD COLUMN     "sourceAttemptKey" TEXT;

-- CreateIndex
CREATE INDEX "CPDRecord_learnerId_sourceAttemptKey_cycleYear_idx" ON "CPDRecord"("learnerId", "sourceAttemptKey", "cycleYear");

