import { z } from 'zod';

export const SubmitQuizAttemptSchema = z.object({
  answers: z.record(z.string(), z.string()).default({}), // questionId -> optionId
});

