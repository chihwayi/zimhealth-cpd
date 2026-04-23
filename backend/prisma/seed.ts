import {
  PrismaClient,
  Role,
  Cadre,
  SubscriptionTier,
  CourseStatus,
  CPDCategory,
  Difficulty,
  Language,
  ContentType,
  QuestionType,
  ActivityType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const nczCouncil = await db.council.upsert({
    where: { acronym: 'NCZ' },
    update: {
      name: 'Nurses Council of Zimbabwe',
      slug: 'nurses-council-of-zimbabwe',
      requiredPoints: 12,
      renewalMonth: 1,
      renewalDay: 31,
      registrationPrefix: 'NCZ',
      allowedTitles: ['Registered General Nurse', 'Registered Midwife', 'Enrolled Nurse', 'Community Health Nurse'],
      isActive: true,
    },
    create: {
      name: 'Nurses Council of Zimbabwe',
      slug: 'nurses-council-of-zimbabwe',
      acronym: 'NCZ',
      requiredPoints: 12,
      renewalMonth: 1,
      renewalDay: 31,
      registrationPrefix: 'NCZ',
      allowedTitles: ['Registered General Nurse', 'Registered Midwife', 'Enrolled Nurse', 'Community Health Nurse'],
    },
  });

  const mdpczCouncil = await db.council.upsert({
    where: { acronym: 'MDPCZ' },
    update: {
      name: 'Medical and Dental Practitioners Council of Zimbabwe',
      slug: 'medical-dental-practitioners-council-of-zimbabwe',
      requiredPoints: 15,
      renewalMonth: 12,
      renewalDay: 31,
      registrationPrefix: 'MDPCZ',
      allowedTitles: ['Medical Doctor', 'Dentist', 'Specialist Doctor', 'Clinical Officer'],
      isActive: true,
    },
    create: {
      name: 'Medical and Dental Practitioners Council of Zimbabwe',
      slug: 'medical-dental-practitioners-council-of-zimbabwe',
      acronym: 'MDPCZ',
      requiredPoints: 15,
      renewalMonth: 12,
      renewalDay: 31,
      registrationPrefix: 'MDPCZ',
      allowedTitles: ['Medical Doctor', 'Dentist', 'Specialist Doctor', 'Clinical Officer'],
    },
  });

  await db.council.upsert({
    where: { acronym: 'PCZ' },
    update: {
      name: 'Pharmacists Council of Zimbabwe',
      slug: 'pharmacists-council-of-zimbabwe',
      requiredPoints: 60,
      registrationPrefix: 'PCZ',
      allowedTitles: ['Pharmacist', 'Pharmacy Technician'],
      isActive: true,
    },
    create: {
      name: 'Pharmacists Council of Zimbabwe',
      slug: 'pharmacists-council-of-zimbabwe',
      acronym: 'PCZ',
      requiredPoints: 60,
      registrationPrefix: 'PCZ',
      allowedTitles: ['Pharmacist', 'Pharmacy Technician'],
    },
  });

  // Additional councils from "Zimbabwe Health Councils CPD Overview.xlsx"
  // Some councils are marked "Required" without a published number; seed defaults (12) and adjust via Admin UI.
  await db.council.upsert({
    where: { acronym: 'MLCSCZ' },
    update: {
      name: 'Medical Laboratory and Clinical Scientists Council of Zimbabwe',
      slug: 'medical-laboratory-clinical-scientists-council-of-zimbabwe',
      requiredPoints: 12,
      registrationPrefix: 'MLCSCZ',
      allowedTitles: ['Laboratory Scientist', 'Laboratory Technician', 'Cytotechnologist'],
      isActive: true,
    },
    create: {
      name: 'Medical Laboratory and Clinical Scientists Council of Zimbabwe',
      slug: 'medical-laboratory-clinical-scientists-council-of-zimbabwe',
      acronym: 'MLCSCZ',
      requiredPoints: 12,
      registrationPrefix: 'MLCSCZ',
      allowedTitles: ['Laboratory Scientist', 'Laboratory Technician', 'Cytotechnologist'],
    },
  });

  await db.council.upsert({
    where: { acronym: 'AHPCZ' },
    update: {
      name: 'Allied Health Practitioners Council of Zimbabwe',
      slug: 'allied-health-practitioners-council-of-zimbabwe',
      requiredPoints: 50,
      registrationPrefix: 'AHPCZ',
      allowedTitles: ['Radiographer', 'Psychologist', 'Nutritionist', 'Occupational Health Practitioner'],
      isActive: true,
    },
    create: {
      name: 'Allied Health Practitioners Council of Zimbabwe',
      slug: 'allied-health-practitioners-council-of-zimbabwe',
      acronym: 'AHPCZ',
      requiredPoints: 50,
      registrationPrefix: 'AHPCZ',
      allowedTitles: ['Radiographer', 'Psychologist', 'Nutritionist', 'Occupational Health Practitioner'],
    },
  });

  await db.council.upsert({
    where: { acronym: 'MRPCZ' },
    update: {
      name: 'Medical Rehabilitation Practitioners Council of Zimbabwe',
      slug: 'medical-rehabilitation-practitioners-council-of-zimbabwe',
      requiredPoints: 12,
      registrationPrefix: 'MRPCZ',
      allowedTitles: ['Physiotherapist', 'Occupational Therapist', 'Speech Therapist'],
      isActive: true,
    },
    create: {
      name: 'Medical Rehabilitation Practitioners Council of Zimbabwe',
      slug: 'medical-rehabilitation-practitioners-council-of-zimbabwe',
      acronym: 'MRPCZ',
      requiredPoints: 12,
      registrationPrefix: 'MRPCZ',
      allowedTitles: ['Physiotherapist', 'Occupational Therapist', 'Speech Therapist'],
    },
  });

  await db.council.upsert({
    where: { acronym: 'EHPCZ' },
    update: {
      name: 'Environmental Health Practitioners Council of Zimbabwe',
      slug: 'environmental-health-practitioners-council-of-zimbabwe',
      requiredPoints: 12,
      registrationPrefix: 'EHPCZ',
      allowedTitles: ['Health Inspector', 'Public Health Officer', 'Environmental Health Technician'],
      isActive: true,
    },
    create: {
      name: 'Environmental Health Practitioners Council of Zimbabwe',
      slug: 'environmental-health-practitioners-council-of-zimbabwe',
      acronym: 'EHPCZ',
      requiredPoints: 12,
      registrationPrefix: 'EHPCZ',
      allowedTitles: ['Health Inspector', 'Public Health Officer', 'Environmental Health Technician'],
    },
  });

  await db.council.upsert({
    where: { acronym: 'NTCZ' },
    update: {
      name: 'Natural Therapists Council of Zimbabwe',
      slug: 'natural-therapists-council-of-zimbabwe',
      requiredPoints: 12,
      registrationPrefix: 'NTCZ',
      allowedTitles: ['Homeopath', 'Naturopath', 'Acupuncturist'],
      isActive: true,
    },
    create: {
      name: 'Natural Therapists Council of Zimbabwe',
      slug: 'natural-therapists-council-of-zimbabwe',
      acronym: 'NTCZ',
      requiredPoints: 12,
      registrationPrefix: 'NTCZ',
      allowedTitles: ['Homeopath', 'Naturopath', 'Acupuncturist'],
    },
  });

  // ─── 1. Admin user ──────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@1234', 12);
  const admin = await db.user.upsert({
    where: { email: 'admin@zimhealthcpd.co.zw' },
    update: {},
    create: {
      email: 'admin@zimhealthcpd.co.zw',
      passwordHash: adminPassword,
      fullName: 'Platform Admin',
      role: Role.ADMIN,
      isApproved: true,
    },
  });
  console.log('✅ Admin user:', admin.email);

  // ─── 2. Content Manager ─────────────────────────────────────────────────────
  const creatorPassword = await bcrypt.hash('Creator@1234', 12);
  const creator = await db.user.upsert({
    where: { email: 'creator@zimhealthcpd.co.zw' },
    update: {},
    create: {
      email: 'creator@zimhealthcpd.co.zw',
      passwordHash: creatorPassword,
      fullName: 'Dr. Tendai Mupfupi',
      role: Role.CONTENT_MANAGER,
      isApproved: true,
    },
  });
  console.log('✅ Content Manager:', creator.email);

  // ─── 3. NCZ Officer ─────────────────────────────────────────────────────────
  const nczPassword = await bcrypt.hash('Ncz@12345', 12);
  const ncz = await db.user.upsert({
    where: { email: 'officer@ncz.co.zw' },
    update: { councilId: nczCouncil.id, professionalTitle: 'Council Officer' },
    create: {
      email: 'officer@ncz.co.zw',
      passwordHash: nczPassword,
      fullName: 'NCZ Compliance Officer',
      role: Role.NCZ_OFFICER,
      councilId: nczCouncil.id,
      professionalTitle: 'Council Officer',
      isApproved: true,
    },
  });
  console.log('✅ NCZ Officer:', ncz.email);

  // ─── 3b. Council Officer (generic role; same portal) ────────────────────────
  const councilOfficerPassword = await bcrypt.hash('Council@12345', 12);
  const councilOfficer = await db.user.upsert({
    where: { email: 'officer@council.co.zw' },
    update: { councilId: nczCouncil.id, professionalTitle: 'Council Officer' },
    create: {
      email: 'officer@council.co.zw',
      passwordHash: councilOfficerPassword,
      fullName: 'Council Compliance Officer',
      role: Role.COUNCIL_OFFICER,
      councilId: nczCouncil.id,
      professionalTitle: 'Council Officer',
      isApproved: true,
    },
  });
  console.log('✅ Council Officer:', councilOfficer.email);

  // ─── 4. Sample learners ─────────────────────────────────────────────────────
  const learnerPassword = await bcrypt.hash('Learner@1234', 12);
  const learners = await Promise.all([
    db.user.upsert({
      where: { email: 'grace@zimhealthcpd.co.zw' },
      update: {
        councilId: nczCouncil.id,
        professionalTitle: 'Registered General Nurse',
        registrationNumber: 'NCZ-2021-001234',
      },
      create: {
        email: 'grace@zimhealthcpd.co.zw',
        passwordHash: learnerPassword,
        fullName: 'Grace Moyo',
        role: Role.LEARNER,
        councilId: nczCouncil.id,
        professionalTitle: 'Registered General Nurse',
        registrationNumber: 'NCZ-2021-001234',
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
      where: { email: 'chipo@zimhealthcpd.co.zw' },
      update: {
        councilId: nczCouncil.id,
        professionalTitle: 'Registered Midwife',
        registrationNumber: 'NCZ-2020-005678',
      },
      create: {
        email: 'chipo@zimhealthcpd.co.zw',
        passwordHash: learnerPassword,
        fullName: 'Chipo Ndlovu',
        role: Role.LEARNER,
        councilId: nczCouncil.id,
        professionalTitle: 'Registered Midwife',
        registrationNumber: 'NCZ-2020-005678',
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

  // ─── 5. Sample course ───────────────────────────────────────────────────────
  const course = await db.course.upsert({
    where: { id: 'course-seed-001' },
    update: {
      targetCouncilIds: [nczCouncil.id, mdpczCouncil.id],
      targetTitles: ['Registered General Nurse', 'Registered Midwife', 'Clinical Officer'],
    },
    create: {
      id: 'course-seed-001',
      title: 'Essential Infection Prevention and Control',
      subtitle: 'Core IPC practices for all healthcare settings',
      description:
        'This course covers the fundamental principles of infection prevention and control (IPC) in line with the WHO guidelines and MOHCC standards for Zimbabwe. On completion, health professionals will be able to apply standard precautions, implement transmission-based precautions, and manage healthcare-associated infections.',
      category: CPDCategory.CLINICAL,
      targetCadres: ['NURSE', 'MIDWIFE', 'CLINICAL_OFFICER'],
      targetCouncilIds: [nczCouncil.id, mdpczCouncil.id],
      targetTitles: ['Registered General Nurse', 'Registered Midwife', 'Clinical Officer'],
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
      content:
        '<h2>What are Standard Precautions?</h2><p>Standard precautions are the minimum infection prevention practices that apply to all patient care, regardless of suspected or confirmed infection status of the patient, in any setting where healthcare is delivered.</p>',
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
  console.log('  Admin:    admin@zimhealthcpd.co.zw / Admin@1234');
  console.log('  Creator:  creator@zimhealthcpd.co.zw / Creator@1234');
  console.log('  NCZ:      officer@ncz.co.zw / Ncz@12345');
  console.log('  Council:  officer@council.co.zw / Council@12345');
  console.log('  Learner:  grace@zimhealthcpd.co.zw / Learner@1234');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
