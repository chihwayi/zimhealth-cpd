import { z } from 'zod';

export const CreateCourseSchema = z.object({
  title: z.string().min(3).max(100),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10),
  category: z.enum(['CLINICAL', 'MANAGEMENT', 'ETHICS', 'RESEARCH']),
  isPublicToAll: z.boolean().default(false),
  targetCadres: z.array(z.string()).default([]),
  targetCouncilIds: z.array(z.string()).default([]),
  targetTitles: z.array(z.string()).default([]),
  specialtyArea: z.string().max(100).optional(),
  difficulty: z.enum(['FOUNDATION', 'INTERMEDIATE', 'ADVANCED']).default('FOUNDATION'),
  language: z.enum(['ENGLISH', 'SHONA', 'NDEBELE']).default('ENGLISH'),
  // Council assigns final CPD points per council at approval time.
  cpdPoints: z.number().int().min(0).max(50).default(0),
  estimatedMinutes: z.number().int().min(5),
  accreditationBody: z.string().max(200).optional(),
  thumbnailUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
  priceOverride: z.number().positive().optional(),
});

export const UpdateCourseSchema = CreateCourseSchema.partial();

export const CourseApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().max(500).optional(),
  reviewerNotes: z.string().max(1000).optional(),
});

export const CreateModuleSchema = z.object({
  title: z.string().min(2).max(200),
  order: z.number().int().min(1),
  isOfflineReady: z.boolean().default(false),
});

export const CreateSectionSchema = z.object({
  type: z.enum(['VIDEO', 'READING', 'AUDIO', 'INTERACTIVE', 'QUIZ']),
  title: z.string().min(2),
  order: z.number().int().min(1),
  content: z.string().default(''),
  mediaUrl: z.string().url().optional(),
  completionThreshold: z.number().min(0).max(1).default(0.8),
});
