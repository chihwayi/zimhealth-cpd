# Sprint 02 — Database Schema & Prisma

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** Run all Prisma migrations, generate client, seed dev data. The database must be fully ready before any API work begins.

---

## Inputs (must be complete from S01)
- [ ] Docker Postgres running on port 5432
- [ ] `backend/src/db/schema.prisma` exists with all models
- [ ] `backend/package.json` has `prisma` and `@prisma/client` as deps
- [ ] `.env` has valid `DATABASE_URL`

---

## Tasks

### T02.1 — Move schema.prisma to the correct Prisma location

The Prisma CLI looks for the schema at `prisma/schema.prisma` by default within the `backend` package.

CREATE FILE: `backend/prisma/schema.prisma`
Copy the ENTIRE content from `backend/src/db/schema.prisma` into this file.
(The `backend/src/db/schema.prisma` file was the initial scaffold — the authoritative location for Prisma is `backend/prisma/schema.prisma`.)

EDIT FILE: `backend/package.json`
Add under `"scripts"`:
```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:studio": "prisma studio",
"db:seed": "ts-node prisma/seed.ts",
"db:reset": "prisma migrate reset --force"
```

---

### T02.2 — Run initial migration

```bash
RUN COMMAND: cd backend && pnpm prisma migrate dev --name init
```

This creates `backend/prisma/migrations/YYYYMMDD_init/migration.sql`.
Verify: Migration runs without errors. Check `\dt` in psql shows all tables.

---

### T02.3 — Generate Prisma client

```bash
RUN COMMAND: cd backend && pnpm prisma generate
```

Verify: `node_modules/@prisma/client` is updated. No TypeScript errors when importing `PrismaClient`.

---

### T02.4 — Create database seed file

CREATE FILE: `backend/prisma/seed.ts`
```typescript
import { PrismaClient, Role, Cadre, SubscriptionTier, CourseStatus, CPDCategory, Difficulty, Language, ContentType, QuestionType, ActivityType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── 1. Admin user ──────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@1234', 12);
  const admin = await db.user.upsert({
    where: { email: 'admin@nursepro.co.zw' },
    update: {},
    create: {
      email: 'admin@nursepro.co.zw',
      passwordHash: adminPassword,
      fullName: 'Platform Admin',
      role: Role.ADMIN,
      isApproved: true,
    },
  });
  console.log('✅ Admin user:', admin.email);

  // ─── 2. Content Manager ──────────────────────────────────────────────────────
  const creatorPassword = await bcrypt.hash('Creator@1234', 12);
  const creator = await db.user.upsert({
    where: { email: 'creator@nursepro.co.zw' },
    update: {},
    create: {
      email: 'creator@nursepro.co.zw',
      passwordHash: creatorPassword,
      fullName: 'Dr. Tendai Mupfupi',
      role: Role.CONTENT_MANAGER,
      isApproved: true,
    },
  });
  console.log('✅ Content Manager:', creator.email);

  // ─── 3. NCZ Officer ──────────────────────────────────────────────────────────
  const nczPassword = await bcrypt.hash('Ncz@12345', 12);
  const ncz = await db.user.upsert({
    where: { email: 'officer@ncz.co.zw' },
    update: {},
    create: {
      email: 'officer@ncz.co.zw',
      passwordHash: nczPassword,
      fullName: 'NCZ Compliance Officer',
      role: Role.NCZ_OFFICER,
      isApproved: true,
    },
  });
  console.log('✅ NCZ Officer:', ncz.email);

  // ─── 4. Sample learners ──────────────────────────────────────────────────────
  const learnerPassword = await bcrypt.hash('Learner@1234', 12);
  const learners = await Promise.all([
    db.user.upsert({
      where: { email: 'grace@nursepro.co.zw' },
      update: {},
      create: {
        email: 'grace@nursepro.co.zw',
        passwordHash: learnerPassword,
        fullName: 'Grace Moyo',
        role: Role.LEARNER,
        cadre: Cadre.NURSE,
        nczRegistrationNumber: 'NCZ-2021-001234',
        institution: 'Parirenyatwa Group of Hospitals',
        province: 'Harare',
        phone: '+263771234567',
        subscriptionTier: SubscriptionTier.STANDARD,
        subscriptionExpiresAt: new Date('2027-01-01'),
      },
    }),
    db.user.upsert({
      where: { email: 'chipo@nursepro.co.zw' },
      update: {},
      create: {
        email: 'chipo@nursepro.co.zw',
        passwordHash: learnerPassword,
        fullName: 'Chipo Ndlovu',
        role: Role.LEARNER,
        cadre: Cadre.MIDWIFE,
        nczRegistrationNumber: 'NCZ-2020-005678',
        institution: 'Mpilo Central Hospital',
        province: 'Bulawayo',
        phone: '+263772345678',
        subscriptionTier: SubscriptionTier.FREE,
      },
    }),
  ]);
  console.log('✅ Learners:', learners.map((l) => l.email).join(', '));

  // ─── 5. Sample course ─────────────────────────────────────────────────────────
  const course = await db.course.upsert({
    where: { id: 'course-seed-001' },
    update: {},
    create: {
      id: 'course-seed-001',
      title: 'Essential Infection Prevention and Control',
      subtitle: 'Core IPC practices for all healthcare settings',
      description: 'This course covers the fundamental principles of infection prevention and control (IPC) in line with the WHO guidelines and MOHCC standards for Zimbabwe. On completion, nurses will be able to apply standard precautions, implement transmission-based precautions, and manage healthcare-associated infections.',
      category: CPDCategory.CLINICAL,
      targetCadres: ['NURSE', 'MIDWIFE', 'CLINICAL_OFFICER'],
      specialtyArea: 'Infection Control',
      difficulty: Difficulty.FOUNDATION,
      language: Language.ENGLISH,
      cpdPoints: 3,
      estimatedMinutes: 90,
      accreditationBody: 'NCZ',
      tags: ['IPC', 'infection control', 'hand hygiene', 'PPE'],
      status: CourseStatus.PUBLISHED,
      creatorId: creator.id,
    },
  });

  // Module
  const module1 = await db.module.upsert({
    where: { id: 'module-seed-001' },
    update: {},
    create: {
      id: 'module-seed-001',
      courseId: course.id,
      title: 'Module 1: Standard Precautions',
      order: 1,
      isOfflineReady: true,
    },
  });

  // Content section
  await db.contentSection.upsert({
    where: { id: 'section-seed-001' },
    update: {},
    create: {
      id: 'section-seed-001',
      moduleId: module1.id,
      type: ContentType.READING,
      title: 'Introduction to Standard Precautions',
      order: 1,
      content: '<h2>What are Standard Precautions?</h2><p>Standard precautions are the minimum infection prevention practices that apply to all patient care, regardless of suspected or confirmed infection status of the patient, in any setting where healthcare is delivered.</p>',
      completionThreshold: 1.0,
    },
  });

  // Quiz
  const quiz = await db.quiz.upsert({
    where: { id: 'quiz-seed-001' },
    update: {},
    create: {
      id: 'quiz-seed-001',
      moduleId: module1.id,
      courseId: course.id,
      title: 'Module 1 Assessment',
      passMark: 0.7,
      attemptLimit: 3,
      randomiseQuestions: false,
      showAnswersAfter: true,
    },
  });

  // Question
  const q1 = await db.question.upsert({
    where: { id: 'question-seed-001' },
    update: {},
    create: {
      id: 'question-seed-001',
      quizId: quiz.id,
      type: QuestionType.MULTIPLE_CHOICE,
      text: 'Standard precautions apply to which patients?',
      points: 1,
      order: 1,
      topicTag: 'standard-precautions',
    },
  });

  await db.questionOption.createMany({
    skipDuplicates: true,
    data: [
      { id: 'opt-s001-1', questionId: q1.id, text: 'Only patients with known infections', isCorrect: false },
      { id: 'opt-s001-2', questionId: q1.id, text: 'All patients, regardless of infection status', isCorrect: true },
      { id: 'opt-s001-3', questionId: q1.id, text: 'Only surgical patients', isCorrect: false },
      { id: 'opt-s001-4', questionId: q1.id, text: 'Only patients in ICU', isCorrect: false },
    ],
  });

  // CPD Record for Grace
  await db.cPDRecord.upsert({
    where: { id: 'cpd-seed-001' },
    update: {},
    create: {
      id: 'cpd-seed-001',
      learnerId: learners[0].id,
      courseId: course.id,
      activityType: ActivityType.QUIZ_PASS,
      pointsEarned: 3,
      quizScore: 0.9,
      cycleYear: 2026,
      syncedToNcz: false,
    },
  });

  console.log('✅ Sample course and CPD data seeded');
  console.log('\n🎉 Seed complete!\n');
  console.log('Dev credentials:');
  console.log('  Admin:    admin@nursepro.co.zw / Admin@1234');
  console.log('  Creator:  creator@nursepro.co.zw / Creator@1234');
  console.log('  NCZ:      officer@ncz.co.zw / Ncz@12345');
  console.log('  Learner:  grace@nursepro.co.zw / Learner@1234');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

---

### T02.5 — Run seed

```bash
RUN COMMAND: cd backend && pnpm db:seed
```
Verify: Console shows all ✅ lines and prints dev credentials.

---

### T02.6 — Create Prisma client singleton

CREATE FILE: `backend/src/lib/db.ts`
```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db;
}
```

---

### T02.7 — Create Redis client singleton

CREATE FILE: `backend/src/lib/redis.ts`
```typescript
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => console.error('[Redis] Error:', err.message));
redis.on('connect', () => console.log('[Redis] Connected'));
```

---

### T02.8 — Create logger

CREATE FILE: `backend/src/lib/logger.ts`
```typescript
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (msg: string, meta?: unknown) => console.log(`[INFO] ${msg}`, meta ?? ''),
  warn: (msg: string, meta?: unknown) => console.warn(`[WARN] ${msg}`, meta ?? ''),
  error: (msg: string, meta?: unknown) => console.error(`[ERROR] ${msg}`, meta ?? ''),
  debug: (msg: string, meta?: unknown) => { if (isDev) console.debug(`[DEBUG] ${msg}`, meta ?? ''); },
};
```

---

## Validation Checklist

- [ ] `pnpm prisma migrate dev --name init` runs without errors
- [ ] `pnpm prisma studio` opens at localhost:5555 and shows all tables populated
- [ ] `pnpm db:seed` runs and prints all ✅ lines
- [ ] Prisma Studio shows: 4 users, 1 course, 1 module, 1 content section, 1 quiz, 1 question, 4 options, 1 CPD record
- [ ] `backend/src/lib/db.ts` and `redis.ts` and `logger.ts` exist
- [ ] No TypeScript errors in backend

**Sign-off:** Claude Code verifies schema and seed data before S03 begins.
