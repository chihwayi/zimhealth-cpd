# Sprints 16–18 — Creator Portal

---

# Sprint 16 — Creator Portal — Course Builder

**Phase:** 3 — Creator Portal
**Duration:** 1 week
**Goal:** Full course builder UI for Content Managers — create, edit, add modules/sections, upload media, and submit for review.

---

## Design Reference
See `docs/design/DESIGN_SYSTEM.md` → Section 7.5 "Creator Portal — Course Builder"

The layout:
- Left panel (280px): course outline — module list with drag handles
- Main canvas: context-sensitive editor per selected section
- Top bar: auto-save indicator + Preview + Submit for Review button

---

## Tasks

### T16.1 — Creator Dashboard page

EDIT FILE: `apps/web/src/pages/creator/CreatorDashboard.tsx`
Replace stub with:
```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Eye, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';

interface MyCourse {
  id: string; title: string; status: string; cpdPoints: number;
  _count: { enrollments: number };
}

export default function CreatorDashboard() {
  const { data, isLoading } = useQuery<{ courses: MyCourse[] }>({
    queryKey: ['creator-courses'],
    queryFn: () => api.get('/api/creator/courses'),
  });

  const courses = data?.courses ?? [];
  const published = courses.filter((c) => c.status === 'PUBLISHED').length;
  const drafts = courses.filter((c) => c.status === 'DRAFT').length;
  const underReview = courses.filter((c) => c.status === 'UNDER_REVIEW').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Creator Portal</h1>
          <p className="text-slate-500 mt-1">Manage your CPD courses</p>
        </div>
        <Link to="/creator/courses/new" className="flex items-center gap-2 bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-primary-600 transition-colors text-sm">
          <Plus size={16} /> New Course
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Courses" value={courses.length} icon={<BookOpen size={20} />} accent="teal" />
        <StatCard title="Published" value={published} icon={<CheckCircle size={20} />} accent="green" />
        <StatCard title="Under Review" value={underReview} icon={<Clock size={20} />} accent="amber" />
        <StatCard title="Drafts" value={drafts} icon={<Eye size={20} />} accent="blue" />
      </div>

      {/* Course list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">My Courses</h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500">No courses yet.</p>
            <Link to="/creator/courses/new" className="text-primary-600 hover:underline text-sm mt-1 inline-block">Create your first course →</Link>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{course.title}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500">{course._count.enrollments}</td>
                  <td className="px-6 py-4">
                    <Link to={`/creator/courses/${course.id}/edit`} className="text-primary-600 hover:underline text-sm">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: 'bg-green-100 text-green-700',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
    DRAFT: 'bg-slate-100 text-slate-600',
    ARCHIVED: 'bg-slate-100 text-slate-400',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
```

---

### T16.2 — Creator backend routes

CREATE FILE: `backend/src/routes/creator.ts`
```typescript
import { Router } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// GET /api/creator/courses — creator's own courses
router.get('/courses', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const courses = await db.course.findMany({
      where: req.user!.role === 'ADMIN' ? {} : { creatorId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } },
      },
    });
    res.json({ courses });
  } catch {
    res.status(500).json({ error: 'Could not fetch courses' });
  }
});

// GET /api/creator/courses/:id/analytics
router.get('/courses/:id/analytics', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const course = await db.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (req.user!.role !== 'ADMIN' && course.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const [enrollmentCount, completedCount, quizAttempts] = await Promise.all([
      db.enrollment.count({ where: { courseId: req.params.id } }),
      db.enrollment.count({ where: { courseId: req.params.id, completedAt: { not: null } } }),
      db.quizAttempt.findMany({
        where: { quiz: { courseId: req.params.id } },
        select: { score: true, passed: true },
      }),
    ]);

    const avgScore = quizAttempts.length
      ? quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length
      : 0;
    const passRate = quizAttempts.length
      ? quizAttempts.filter((a) => a.passed).length / quizAttempts.length
      : 0;

    res.json({
      enrollmentCount,
      completionRate: enrollmentCount ? completedCount / enrollmentCount : 0,
      avgQuizScore: Math.round(avgScore * 100),
      passRate: Math.round(passRate * 100),
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

export default router;
```

EDIT FILE: `backend/src/app.ts`
Add:
```typescript
import creatorRouter from './routes/creator';
// ...
app.use('/api/creator', creatorRouter);
```

---

### T16.3 — Course Builder page

CREATE FILE: `apps/web/src/pages/creator/CourseBuilder.tsx`

This is a complex page. Implement these sections in order:

**Part 1 — Metadata form (left side)**
- All fields from the spec: title, subtitle, description (TipTap), category, targetCadres, difficulty, language, cpdPoints, estimatedMinutes, tags
- Use React Hook Form + Zod validation
- Auto-save on 3-second debounce after any change (PATCH /api/courses/:id)

**Part 2 — Module list (right panel)**
- List of modules for this course
- "Add module" button → POST /api/courses/:id/modules
- Each module shows its sections (reading/video/quiz icons)
- Click module/section to open the section editor

**Part 3 — Section editor (modal or inline)**
For VIDEO sections: URL input + upload button
For READING sections: TipTap editor
For QUIZ sections: "Go to Quiz Builder" link (S17)

**Part 4 — Top action bar**
- Auto-save status indicator ("Saved", "Saving…", "Unsaved changes")
- "Preview" button (opens course in learner view in new tab)
- "Submit for Review" button (calls POST /api/courses/:id/submit-review)

---

### T16.4 — Update App.tsx with creator routes

EDIT FILE: `apps/web/src/App.tsx`
Add creator sub-routes inside the `/creator/*` route:
```tsx
// Inside creator ProtectedRoute
<Routes>
  <Route path="/creator" element={<AppShell><CreatorDashboard /></AppShell>} />
  <Route path="/creator/courses/new" element={<AppShell><CourseBuilder /></AppShell>} />
  <Route path="/creator/courses/:id/edit" element={<AppShell><CourseBuilder /></AppShell>} />
  <Route path="/creator/analytics" element={<AppShell><CreatorAnalytics /></AppShell>} />
</Routes>
```

Create placeholder stubs for CreatorAnalytics (Sprint 18 builds it fully).

---

## Validation Checklist (S16)

- [ ] Creator dashboard shows course list with status badges
- [ ] "New Course" button navigates to course builder
- [ ] Course metadata form saves via PATCH /api/courses/:id on debounce
- [ ] Module can be added to a course
- [ ] Section (reading type) can be added to a module with TipTap content
- [ ] "Submit for Review" changes status to UNDER_REVIEW
- [ ] Creator cannot see other creators' courses
- [ ] Auto-save indicator shows correct state

---

# Sprint 17 — Creator Portal — Quiz Builder & AI Question Generation

**Phase:** 3
**Duration:** 1 week
**Goal:** Full quiz builder UI + AI-assisted question generation from pasted content.

---

## Tasks

### T17.1 — Quiz builder routes (backend)

CREATE FILE: `backend/src/routes/quizzes.ts`
Implement:
- `POST /api/quizzes` — create quiz for a module
- `GET /api/quizzes/:id` — get quiz with all questions and options
- `PATCH /api/quizzes/:id` — update quiz settings
- `POST /api/quizzes/:id/questions` — add question
- `PATCH /api/quizzes/:id/questions/:qid` — update question
- `DELETE /api/quizzes/:id/questions/:qid` — delete question
- `POST /api/quizzes/:id/attempt` — learner submits answers (from S10)

All quiz mutation endpoints require CONTENT_MANAGER or ADMIN role.
The attempt endpoint requires LEARNER role.

---

### T17.2 — AI question generation endpoint

CREATE FILE: `backend/src/services/ai-question-gen.ts`
```typescript
import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@nursepro/ai-client';
import { z } from 'zod';

const GeneratedQuestionSchema = z.object({
  text: z.string(),
  options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).length(4),
  explanation: z.string(),
});

export async function generateQuestionsFromText(
  sourceText: string,
  count: number = 5,
): Promise<z.infer<typeof GeneratedQuestionSchema>[]> {
  const config: AIProviderConfig = {
    anthropic: process.env.ANTHROPIC_API_KEY
      ? { apiKey: process.env.ANTHROPIC_API_KEY, defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6' }
      : undefined,
    openai: process.env.OPENAI_API_KEY
      ? { apiKey: process.env.OPENAI_API_KEY, defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' }
      : undefined,
    gemini: process.env.GEMINI_API_KEY
      ? { apiKey: process.env.GEMINI_API_KEY, defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro' }
      : undefined,
    ollama: process.env.OLLAMA_BASE_URL
      ? { baseUrl: process.env.OLLAMA_BASE_URL, defaultModel: process.env.OLLAMA_MODEL ?? 'llama3' }
      : undefined,
  };

  const ai = new AIClient(config);

  const prompt = `Generate exactly ${count} multiple choice questions from this clinical text.
Return ONLY a valid JSON array. No markdown, no explanation.

Format:
[
  {
    "text": "Question text here",
    "options": [
      { "text": "Option A", "isCorrect": false },
      { "text": "Option B", "isCorrect": true },
      { "text": "Option C", "isCorrect": false },
      { "text": "Option D", "isCorrect": false }
    ],
    "explanation": "Why the correct answer is correct"
  }
]

Source text:
"""
${sourceText.slice(0, 3000)}
"""`;

  const raw = await ai.complete(prompt, {
    systemPrompt: SYSTEM_PROMPTS.QUIZ_GENERATOR,
    maxTokens: 2000,
    temperature: 0.4,
  });

  // Extract JSON from response (strip any wrapping markdown)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  return z.array(GeneratedQuestionSchema).parse(parsed);
}
```

Add route to `backend/src/routes/quizzes.ts`:
```typescript
// POST /api/quizzes/:id/generate-questions — AI question generation (CONTENT_MANAGER only)
router.post('/:id/generate-questions', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { sourceText, count = 5 } = req.body;
    if (!sourceText || sourceText.length < 50) return res.status(400).json({ error: 'sourceText must be at least 50 characters' });
    const questions = await generateQuestionsFromText(sourceText, Math.min(count, 10));
    // Return as DRAFT questions — creator must review before saving
    res.json({ questions, isDraft: true, message: 'Review and edit these questions before adding to your quiz.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'AI question generation failed' });
  }
});
```

---

### T17.3 — Quiz Builder UI

CREATE FILE: `apps/web/src/pages/creator/QuizBuilder.tsx`

Implement:
- Question list with add/edit/delete
- Question editor: type selector (MCQ/T-F), question text, 4 option fields with "correct" radio
- "Generate with AI" panel:
  - Paste text area
  - Count selector (3–10)
  - "Generate Questions" button → calls `/api/quizzes/:id/generate-questions`
  - Shows draft questions in preview cards
  - Creator can "Accept", "Edit", or "Discard" each generated question
  - Accepted questions are saved to quiz via `POST /api/quizzes/:id/questions`

---

## Validation Checklist (S17)

- [ ] Quiz can be created and attached to a module
- [ ] Questions can be added, edited, deleted
- [ ] "Generate with AI" button sends text to backend and returns draft questions
- [ ] Draft questions show with Accept/Edit/Discard UI
- [ ] Accepted questions are saved to quiz
- [ ] Learner can attempt quiz and receive score (from S10)
- [ ] AI generation works with at least one provider configured

---

# Sprint 18 — Creator Analytics

**Phase:** 3
**Duration:** 1 week
**Goal:** Charts and metrics for Content Managers — enrollments over time, completion rates, quiz scores, and ratings.

---

## Tasks

### T18.1 — Analytics API endpoint

Extend `backend/src/routes/creator.ts`:
- `GET /api/creator/courses/:id/analytics/timeseries` — enrollment count per month for last 6 months

### T18.2 — Creator Analytics page

EDIT FILE: `apps/web/src/pages/creator/Analytics.tsx`

Build using Recharts:
- **Enrollments over time**: LineChart — monthly enrollments for all courses combined
- **Per-course stats table**: course title, enrollments, completion %, avg quiz score, pass rate
- **Rating distribution**: BarChart — 1–5 star distribution

All charts use colours from the design system (primary-500, accent-500).

---

## Validation Checklist (S18)

- [ ] Analytics page renders without errors
- [ ] Enrollment LineChart shows real data from API
- [ ] Per-course table shows completion rate and quiz pass rate
- [ ] Charts use correct design system colours
- [ ] Empty state shown when no courses exist

**Sign-off:** Claude Code validates all creator portal flows (S16–S18) as a group.
