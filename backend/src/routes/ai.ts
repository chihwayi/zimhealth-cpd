import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { generateCourseFromGuideline } from '../services/ai-content-gen';
import { db } from '../lib/db';

const router: ExpressRouter = Router();

// ─── POST /api/ai/ingest-guideline ────────────────────────────────────────────
// Accepts plain text, markdown, or a public URL of a national health guideline.
// Generates a full course structure (modules + sections + quizzes) and saves it
// as a DRAFT course for content manager review before publishing.
router.post(
  '/ingest-guideline',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    const {
      text,
      url,
      courseTitle,
      targetCadre = 'Registered General Nurse',
      category = 'CLINICAL',
    } = req.body as {
      text?: string;
      url?: string;
      courseTitle?: string;
      targetCadre?: string;
      category?: string;
    };

    // ── Resolve source text ──────────────────────────────────────────────────
    let guidelineText = text?.trim() ?? '';

    if (!guidelineText && url) {
      try {
        const fetched = await fetch(url, {
          headers: { 'User-Agent': 'NursePro-CPD-Bot/1.0' },
          signal: AbortSignal.timeout(15_000),
        });
        if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);

        const contentType = fetched.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          const html = await fetched.text();
          // Strip tags to extract readable text — keep paragraphs and headings
          guidelineText = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/\s{2,}/g, ' ')
            .trim();
        } else if (contentType.includes('text/')) {
          guidelineText = await fetched.text();
        } else {
          return res.status(400).json({ error: 'URL must return HTML or plain text. PDFs are not yet supported.' });
        }
      } catch (err: any) {
        return res.status(400).json({ error: `Could not fetch URL: ${err?.message ?? 'unknown error'}` });
      }
    }

    if (guidelineText.length < 100) {
      return res.status(400).json({ error: 'Guideline text must be at least 100 characters' });
    }

    if (!courseTitle || courseTitle.trim().length < 3) {
      return res.status(400).json({ error: 'courseTitle is required (min 3 characters)' });
    }

    // ── Generate course content from AI ──────────────────────────────────────
    try {
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

      res.status(201).json({
        courseId: result.id,
        title: result.title,
        status: 'DRAFT',
        moduleCount: generated.modules.length,
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
