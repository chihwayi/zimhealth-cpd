-- CreateTable
CREATE TABLE "LanguagePack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "translations" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguagePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LanguagePack_code_key" ON "LanguagePack"("code");

-- CreateIndex
CREATE INDEX "LanguagePack_isActive_idx" ON "LanguagePack"("isActive");

-- CreateIndex
CREATE INDEX "LanguagePack_countryCodes_idx" ON "LanguagePack"("countryCodes");

-- AddForeignKey
ALTER TABLE "LanguagePack" ADD CONSTRAINT "LanguagePack_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

