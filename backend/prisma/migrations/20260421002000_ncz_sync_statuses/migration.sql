-- CreateEnum
CREATE TYPE "NczSyncStatus" AS ENUM ('PENDING', 'BLOCKED_MISSING_NCZ', 'SYNCED', 'FAILED');

-- AlterTable
ALTER TABLE "CPDRecord"
ADD COLUMN     "nczSyncStatus" "NczSyncStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "nczLastError" TEXT,
ADD COLUMN     "nczLastAttemptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NczSyncLog"
ADD COLUMN     "dryRun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meta" JSONB;

