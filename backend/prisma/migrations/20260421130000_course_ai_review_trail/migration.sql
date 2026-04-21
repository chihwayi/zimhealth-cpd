-- AlterTable
ALTER TABLE "Course"
ADD COLUMN     "aiSourceName" TEXT,
ADD COLUMN     "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiGeneratedProvider" TEXT,
ADD COLUMN     "aiReviewNotes" TEXT;

