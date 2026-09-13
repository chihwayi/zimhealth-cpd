-- AlterTable
ALTER TABLE "Council" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'ZW',
ADD COLUMN     "countryName" TEXT NOT NULL DEFAULT 'Zimbabwe';

-- CreateIndex
CREATE INDEX "Council_countryCode_idx" ON "Council"("countryCode");

