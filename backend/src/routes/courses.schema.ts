import { z } from 'zod';

export const CreateCourseSchema = z.object({
  title: z.string().min(3).max(100),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10),
  category: z.enum(['CLINICAL', 'MANAGEMENT', 'ETHICS', 'RESEARCH']),
  targetCadres: z.array(z.string()).min(1),
  specialtyArea: z.string().optional(),
  difficulty: z.enum(['FOUNDATION', 'INTERMEDIATE', 'ADVANCED']).default('FOUNDATION'),
  language: z.enum(['ENGLISH', 'SHONA', 'NDEBELE']).default('ENGLISH'),
  cpdPoints: z.number().int().min(1).max(50),
  estimatedMinutes: z.number().int().min(5),
  accreditationBody: z.string().optional(),
  tags: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
  priceOverride: z.number().positive().optional(),
});

export const UpdateCourseSchema = CreateCourseSchema.partial();

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

