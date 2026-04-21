import { z } from 'zod';

export const UpdateProgressSchema = z.object({
  progress: z.number().min(0).max(1).optional(),
  sectionId: z.string().cuid().optional(),
  totalSections: z.number().int().min(0).optional(),
});

export const SubmitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
