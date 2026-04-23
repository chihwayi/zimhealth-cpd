-- Make legacy Course.cpdPoints optional for creators by defaulting to 0.
ALTER TABLE "Course" ALTER COLUMN "cpdPoints" SET DEFAULT 0;

