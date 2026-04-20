import { z } from 'zod';

export const UpdateProgressSchema = z.object({
  progress: z.number().min(0).max(1),
});

