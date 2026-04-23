-- CouncilCourseReview: council-owned approvals + points + rejection reasons

DO $$ BEGIN
  CREATE TYPE "CouncilCourseReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CouncilCourseReview" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "councilId" TEXT NOT NULL,
  "status" "CouncilCourseReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "points" INTEGER,
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CouncilCourseReview_pkey" PRIMARY KEY ("id")
);

-- Relations
ALTER TABLE "CouncilCourseReview"
  ADD CONSTRAINT "CouncilCourseReview_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouncilCourseReview"
  ADD CONSTRAINT "CouncilCourseReview_councilId_fkey"
  FOREIGN KEY ("councilId") REFERENCES "Council"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouncilCourseReview"
  ADD CONSTRAINT "CouncilCourseReview_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Uniqueness: only one review per (course, council)
CREATE UNIQUE INDEX IF NOT EXISTS "CouncilCourseReview_courseId_councilId_key"
  ON "CouncilCourseReview"("courseId", "councilId");

-- Query helpers
CREATE INDEX IF NOT EXISTS "CouncilCourseReview_councilId_status_idx"
  ON "CouncilCourseReview"("councilId", "status");

CREATE INDEX IF NOT EXISTS "CouncilCourseReview_courseId_status_idx"
  ON "CouncilCourseReview"("courseId", "status");

