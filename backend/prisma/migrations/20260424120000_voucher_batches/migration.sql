-- CreateTable
CREATE TABLE "VoucherBatch" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "tier"        "SubscriptionTier" NOT NULL,
    "totalCount"  INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt"   TIMESTAMP(3),
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id"           TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "batchId"      TEXT NOT NULL,
    "tier"         "SubscriptionTier" NOT NULL,
    "redeemedById" TEXT,
    "redeemedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "VoucherBatch_createdById_idx" ON "VoucherBatch"("createdById");
CREATE INDEX "VoucherBatch_createdAt_idx"   ON "VoucherBatch"("createdAt");
CREATE INDEX "Voucher_batchId_idx"          ON "Voucher"("batchId");
CREATE INDEX "Voucher_redeemedById_idx"     ON "Voucher"("redeemedById");

-- AddForeignKey
ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "VoucherBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_redeemedById_fkey"
    FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
