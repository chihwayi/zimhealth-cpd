import { z } from 'zod';

export const SubmitQuizAttemptSchema = z.object({
  answers:      z.record(z.string(), z.string()).default({}), // questionId -> optionId
  attemptedAt:  z.coerce.date().optional(),
  enrollmentId: z.string().optional(),
  sectionId:    z.string().optional(),
});
