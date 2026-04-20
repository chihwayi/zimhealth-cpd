-- AlterTable
ALTER TABLE "CPDRecord" ADD COLUMN     "quizId" TEXT;

-- CreateIndex
CREATE INDEX "CPDRecord_learnerId_quizId_cycleYear_idx" ON "CPDRecord"("learnerId", "quizId", "cycleYear");

-- AddForeignKey
ALTER TABLE "CPDRecord" ADD CONSTRAINT "CPDRecord_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;
