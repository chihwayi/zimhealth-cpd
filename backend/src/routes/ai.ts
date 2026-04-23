import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { generateCourseFromGuideline } from '../services/ai-content-gen';
import { resolveGuidelineText } from '../services/guideline-ingestion';
import { db } from '../lib/db';
import { getAIProvider } from '../lib/redis';

const router: ExpressRouter = Router();

// ─── POST /api/ai/ingest-guideline ────────────────────────────────────────────
// Accepts plain text, markdown, or a public URL of a national health guideline.
// Generates a full course structure (modules + sections + quizzes) and saves it
// as a DRAFT course for content manager review before publishing.
router.post(
  '/ingest-guideline',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    const {
      text,
      url,
      sourceName,
      courseTitle,
      targetCadre = 'Registered General Nurse',
      category = 'CLINICAL',
    } = req.body as {
      text?: string;
      url?: string;
      sourceName?: string;
      courseTitle?: string;
      targetCadre?: string;
      category?: string;
    };

    // ── Resolve source text ──────────────────────────────────────────────────
    let guidelineText = '';
    let sourceType: 'TEXT' | 'HTML' | 'PLAINTEXT' | 'PDF' = 'TEXT';
    let sourceLabel = 'Pasted text';
    let extractedCharacters = 0;
    let warnings: string[] = [];

    try {
      const resolved = await resolveGuidelineText({
        text,
        url,
        fileBuffer: req.file?.buffer,
        fileName: req.file?.originalname,
        mimeType: req.file?.mimetype,
      });
      guidelineText = resolved.guidelineText;
      sourceType = resolved.sourceType;
      sourceLabel = resolved.sourceLabel;
      extractedCharacters = resolved.extractedCharacters;
      warnings = resolved.warnings;
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? 'Could not resolve guideline source' });
    }

    if (guidelineText.length < 100) {
      return res.status(400).json({ error: 'Guideline text must be at least 100 characters' });
    }

    if (!courseTitle || courseTitle.trim().length < 3) {
      return res.status(400).json({ error: 'courseTitle is required (min 3 characters)' });
    }

    // ── Generate course content from AI ──────────────────────────────────────
    try {
      const provider = await getAIProvider().catch(() => null);
      const generated = await generateCourseFromGuideline(
        guidelineText,
        courseTitle.trim(),
        targetCadre,
      );

      // ── Persist as DRAFT course ──────────────────────────────────────────
      const result = await db.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            title: generated.title,
            subtitle: generated.subtitle ?? null,
            description: generated.description,
            category: category as any,
            difficulty: 'INTERMEDIATE',
            language: 'ENGLISH',
            cpdPoints: generated.cpdPoints,
            estimatedMinutes: generated.estimatedMinutes,
            status: 'DRAFT',
            creatorId: req.user!.id,
            aiSourceName: sourceName?.trim() ? sourceName.trim().slice(0, 200) : sourceLabel.slice(0, 200),
            aiGeneratedAt: new Date(),
            aiGeneratedProvider: provider ?? 'auto',
          },
        });

        for (const genModule of generated.modules) {
          const module = await tx.module.create({
            data: { courseId: course.id, title: genModule.title, order: genModule.order },
          });

          for (const sec of genModule.sections) {
            await tx.contentSection.create({
              data: {
                moduleId: module.id,
                type: sec.type,
                title: sec.title,
                order: sec.order,
                content: sec.content,
              },
            });
          }

          const quiz = await tx.quiz.create({
            data: {
              courseId: course.id,
              moduleId: module.id,
              title: genModule.quiz.title,
              passMark: genModule.quiz.passMark,
            },
          });

          for (const q of genModule.quiz.questions) {
            const question = await tx.question.create({
              data: { quizId: quiz.id, text: q.text, order: q.order, type: 'MULTIPLE_CHOICE' },
            });

            for (const opt of q.options) {
              await tx.questionOption.create({
                data: { questionId: question.id, text: opt.text, isCorrect: opt.isCorrect },
              });
            }
          }
        }

        return course;
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'ADMIN_AI_INGESTED_GUIDELINE',
          entityType: 'Course',
          entityId: result.id,
          meta: {
            courseTitle: result.title,
            sourceType,
            sourceLabel: sourceName?.trim() ? sourceName.trim().slice(0, 200) : sourceLabel,
            extractedCharacters,
            warnings,
            provider: provider ?? 'auto',
          },
        },
      });

      res.status(201).json({
        courseId: result.id,
        title: result.title,
        status: 'DRAFT',
        moduleCount: generated.modules.length,
        sourceType,
        sourceLabel,
        extractedCharacters,
        warnings,
        message: `Course draft created with ${generated.modules.length} module(s). Review and publish when ready.`,
      });
    } catch (err: any) {
      if (err?.message?.includes('AI did not return') || err?.name === 'ZodError') {
        return res.status(422).json({ error: 'AI could not generate valid content from this text. Try providing more structured guideline text.' });
      }
      res.status(500).json({ error: 'Content generation failed' });
    }
  },
);

export default router;
