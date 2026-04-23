CREATE TABLE "Council" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "acronym" TEXT NOT NULL,
  "requiredPoints" INTEGER NOT NULL DEFAULT 12,
  "renewalMonth" INTEGER NOT NULL DEFAULT 12,
  "renewalDay" INTEGER NOT NULL DEFAULT 31,
  "registrationPrefix" TEXT,
  "allowedTitles" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Council_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Council_slug_key" ON "Council"("slug");
CREATE UNIQUE INDEX "Council_acronym_key" ON "Council"("acronym");
CREATE INDEX "Council_isActive_idx" ON "Council"("isActive");
CREATE INDEX "Council_name_idx" ON "Council"("name");

ALTER TABLE "User" ADD COLUMN "councilId" TEXT;
ALTER TABLE "User" ADD COLUMN "professionalTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "registrationNumber" TEXT;

ALTER TABLE "Course" ADD COLUMN "targetCouncilIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN "targetTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Course" ADD COLUMN "isPublicToAll" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_registrationNumber_key" ON "User"("registrationNumber");
CREATE INDEX "User_registrationNumber_idx" ON "User"("registrationNumber");
CREATE INDEX "User_councilId_idx" ON "User"("councilId");

ALTER TABLE "User" ADD CONSTRAINT "User_councilId_fkey" FOREIGN KEY ("councilId") REFERENCES "Council"("id") ON DELETE SET NULL ON UPDATE CASCADE;
