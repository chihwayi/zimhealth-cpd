-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "flaggedFast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startedAt" TIMESTAMP(3);

