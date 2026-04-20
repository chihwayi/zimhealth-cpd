-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'LEARNER');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STANDARD', 'INSTITUTION', 'DIASPORA');

-- CreateEnum
CREATE TYPE "Cadre" AS ENUM ('NURSE', 'MIDWIFE', 'PHARMACIST', 'CLINICAL_OFFICER', 'LAB_TECH');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CPDCategory" AS ENUM ('CLINICAL', 'MANAGEMENT', 'ETHICS', 'RESEARCH');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('FOUNDATION', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'SHONA', 'NDEBELE');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'READING', 'AUDIO', 'INTERACTIVE', 'QUIZ');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MATCHING', 'IMAGE_MCQ');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('VIDEO_WATCH', 'QUIZ_PASS', 'READING', 'WEBINAR', 'WHATSAPP_QUIZ');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LEARNER',
    "cadre" "Cadre",
    "nczRegistrationNumber" TEXT,
    "institution" TEXT,
    "province" TEXT,
    "district" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "promoVideoUrl" TEXT,
    "category" "CPDCategory" NOT NULL,
    "targetCadres" TEXT[],
    "specialtyArea" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'FOUNDATION',
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "cpdPoints" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "accreditationBody" TEXT,
    "tags" TEXT[],
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3),
    "priceOverride" DECIMAL(65,30),
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isOfflineReady" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSection" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaKey" TEXT,
    "completionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passMark" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "attemptLimit" INTEGER NOT NULL DEFAULT 3,
    "timeLimitMinutes" INTEGER,
    "randomiseQuestions" BOOLEAN NOT NULL DEFAULT false,
    "showAnswersAfter" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "difficultyTag" TEXT,
    "topicTag" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastAccessAt" TIMESTAMP(3),

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CPDRecord" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "quizScore" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleYear" INTEGER NOT NULL,
    "syncedToNcz" BOOLEAN NOT NULL DEFAULT false,
    "nczSyncedAt" TIMESTAMP(3),
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideNote" TEXT,

    CONSTRAINT "CPDRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "certificateUuid" TEXT NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "coursesCompleted" TEXT[],
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "pdfKey" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReview" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "cdnUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSecs" INTEGER,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NczFlag" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NczFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NczSyncLog" (
    "id" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "recordCount" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NczSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentRef" TEXT,
    "gateway" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nczRegistrationNumber_key" ON "User"("nczRegistrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_nczRegistrationNumber_idx" ON "User"("nczRegistrationNumber");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Course_creatorId_idx" ON "Course"("creatorId");

-- CreateIndex
CREATE INDEX "Course_category_idx" ON "Course"("category");

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_courseId_order_key" ON "Module"("courseId", "order");

-- CreateIndex
CREATE INDEX "ContentSection_moduleId_idx" ON "ContentSection"("moduleId");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_learnerId_quizId_idx" ON "QuizAttempt"("learnerId", "quizId");

-- CreateIndex
CREATE INDEX "Enrollment_learnerId_idx" ON "Enrollment"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_learnerId_courseId_key" ON "Enrollment"("learnerId", "courseId");

-- CreateIndex
CREATE INDEX "CPDRecord_learnerId_cycleYear_idx" ON "CPDRecord"("learnerId", "cycleYear");

-- CreateIndex
CREATE INDEX "CPDRecord_syncedToNcz_idx" ON "CPDRecord"("syncedToNcz");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateUuid_key" ON "Certificate"("certificateUuid");

-- CreateIndex
CREATE INDEX "Certificate_learnerId_idx" ON "Certificate"("learnerId");

-- CreateIndex
CREATE INDEX "Certificate_certificateUuid_idx" ON "Certificate"("certificateUuid");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_courseId_learnerId_key" ON "CourseReview"("courseId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_s3Key_key" ON "MediaAsset"("s3Key");

-- CreateIndex
CREATE INDEX "NczFlag_learnerId_idx" ON "NczFlag"("learnerId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_learnerId_key" ON "Subscription"("learnerId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSection" ADD CONSTRAINT "ContentSection_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CPDRecord" ADD CONSTRAINT "CPDRecord_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CPDRecord" ADD CONSTRAINT "CPDRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NczFlag" ADD CONSTRAINT "NczFlag_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
