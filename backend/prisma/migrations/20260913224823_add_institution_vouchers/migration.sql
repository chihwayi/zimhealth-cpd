-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "inviteeEmail" TEXT,
ADD COLUMN     "inviteePhone" TEXT;

-- AlterTable
ALTER TABLE "VoucherBatch" ADD COLUMN     "institutionContactId" TEXT;

-- CreateIndex
CREATE INDEX "VoucherBatch_institutionContactId_idx" ON "VoucherBatch"("institutionContactId");

-- AddForeignKey
ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_institutionContactId_fkey" FOREIGN KEY ("institutionContactId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

