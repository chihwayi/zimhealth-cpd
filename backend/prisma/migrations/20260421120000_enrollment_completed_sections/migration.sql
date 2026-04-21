-- Add completedSections array to Enrollment for per-section progress tracking
ALTER TABLE "Enrollment" ADD COLUMN "completedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
