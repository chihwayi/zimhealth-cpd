import { z } from 'zod';

export const SubmitQuizAttemptSchema = z.object({
  answers:      z.record(z.string(), z.string()).default({}), // questionId -> optionId
  attemptedAt:  z.coerce.date().optional(),
  // When the learner first saw the quiz questions — a soft, client-reported
  // signal used only to flag implausibly fast submissions for review, never
  // to block a submission on its own.
  startedAt:    z.coerce.date().optional(),
  enrollmentId: z.string().optional(),
  sectionId:    z.string().optional(),
});
