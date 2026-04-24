# Sprint S15 — WhatsApp bot enrollment flow

### Priority: HIGH
### Feature: Feature 1 (Zero barriers to entry) + Feature 6 (Free-to-start)

---

## The Problem

A nurse who registers entirely through WhatsApp (using the `register` command) ends up
with a ZimHealth account but **no enrollments**. When they type "1" to start learning,
the bot calls `GET /api/bot/courses?phone=...` which returns their enrolled courses.
Because they have none, the bot replies:

> "No enrolled courses found. Visit http://localhost:3000 to browse and enrol."

This breaks the "zero barriers to entry" promise. A nurse in a rural clinic using
WhatsApp data bundles should be able to browse available courses and enrol directly
from WhatsApp — without needing a web browser or a standard data plan.

---

## What needs to be built

### Backend — two new endpoints in `backend/src/routes/bot.ts`

**1. `GET /api/bot/courses/available?phone=+263...`**  
Returns all PUBLISHED courses visible to the learner's council (or all public courses)  
that they are NOT yet enrolled in. Capped at 10 to keep the bot list short.

**2. `POST /api/bot/enroll`**  
Body: `{ phone, courseId }`  
Creates an enrollment for the learner, returns the new enrollment ID.

### Bot — new BROWSE state in session + flow in learnHandler

When the bot detects that a learner has no enrolled courses, instead of dead-ending  
with "visit the website", it offers to show available courses and let them enrol.

---

## Step-by-step implementation

### Part A — Backend: `backend/src/routes/bot.ts`

#### A1 — Add `GET /api/bot/courses/available`

Add this route after the existing `GET /api/bot/courses` route:

```ts
// GET /api/bot/courses/available?phone=+263771234567
// Returns up to 10 published courses the learner is not yet enrolled in.
router.get('/courses/available', requireBotSecret, async (req, res) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    const learner = await db.user.findUnique({
      where: { phone },
      select: { id: true, councilId: true },
    });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    // Get IDs of courses the learner is already enrolled in.
    const enrolled = await db.enrollment.findMany({
      where: { learnerId: learner.id },
      select: { courseId: true },
    });
    const enrolledIds = enrolled.map((e) => e.courseId);

    // Courses visible to this learner: council-approved OR public.
    const where: any = {
      status: 'PUBLISHED',
      id: { notIn: enrolledIds },
      OR: [
        { isPublicToAll: true },
        ...(learner.councilId
          ? [{ targetCouncilIds: { has: learner.councilId } }]
          : []),
      ],
    };

    const courses = await db.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        cpdPoints: true,
        estimatedMinutes: true,
        _count: { select: { modules: true } },
      },
    });

    res.json({
      learnerId: learner.id,
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        cpdPoints: c.cpdPoints,
        estimatedMinutes: c.estimatedMinutes,
        moduleCount: c._count.modules,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch available courses' });
  }
});
```

#### A2 — Add `POST /api/bot/enroll`

Add this route after the one above:

```ts
// POST /api/bot/enroll
// Body: { phone, courseId }
router.post('/enroll', requireBotSecret, async (req, res) => {
  const { phone, courseId } = req.body as { phone?: string; courseId?: string };
  if (!phone || !courseId) {
    return res.status(400).json({ error: 'phone and courseId are required' });
  }

  try {
    const learner = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const course = await db.course.findUnique({
      where: { id: courseId, status: 'PUBLISHED' },
      select: { id: true, title: true },
    });
    if (!course) return res.status(404).json({ error: 'Course not available' });

    // Upsert: if already enrolled return existing, otherwise create.
    const enrollment = await db.enrollment.upsert({
      where: { learnerId_courseId: { learnerId: learner.id, courseId } },
      create: { learnerId: learner.id, courseId, progress: 0 },
      update: {},
    });

    res.json({ enrollmentId: enrollment.id, courseTitle: course.title });
  } catch {
    res.status(500).json({ error: 'Enrolment failed' });
  }
});
```

---

### Part B — Bot session: `apps/whatsapp-bot/src/sessionManager.ts`

Open `sessionManager.ts` and find the `BotState` type. Add `'BROWSE'` to the union:

```ts
export type BotState =
  | 'MENU'
  | 'LEARNING'
  | 'QUIZ'
  | 'AI_TUTOR'
  | 'PAYMENT'
  | 'BROWSE';   // ← add this
```

Also find `BotLearningState` (or wherever `courseOptions` is defined) and confirm the
existing `BotCourseOption` type has `id`, `title`, `cpdPoints`, and `moduleCount` fields.
If not, add `cpdPoints: number` and `moduleCount: number` to the type.

---

### Part C — Bot handler: `apps/whatsapp-bot/src/handlers/learnHandler.ts`

#### C1 — Add API helpers at the top of the file (after existing helpers)

```ts
async function fetchAvailableCourses(phone: string): Promise<BotCourseOption[] | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/bot/courses/available?phone=${encodeURIComponent(phone)}`,
      { headers: botHeaders },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.courses ?? null;
  } catch {
    return null;
  }
}

async function enrollInCourse(phone: string, courseId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/bot/enroll`, {
      method: 'POST',
      headers: botHeaders,
      body: JSON.stringify({ phone, courseId }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.enrollmentId ?? null;
  } catch {
    return null;
  }
}
```

#### C2 — Change the "no enrolled courses" dead-end into a browse prompt

In `handleLearn`, find the block that fires when `data.courses.length === 0`:

```ts
// BEFORE (dead end):
if (!data || data.courses.length === 0) {
  await sendMessage(
    msg.from,
    `📚 *No enrolled courses found.*\n\nVisit ${WEB_URL} to browse and enrol in courses.\n\nReply *menu* to go back.`,
  );
  session.state = 'MENU';
  await saveSession(session);
  return;
}
```

Replace it with:

```ts
if (!data || data.courses.length === 0) {
  // Learner has no enrollments — offer to show available courses instead of dead-ending.
  const available = await fetchAvailableCourses(phone);

  if (!available || available.length === 0) {
    await sendMessage(
      msg.from,
      `📚 *No courses available right now.*\n\nNew courses are added regularly. Visit ${WEB_URL} for the full library.\n\nReply *menu* to go back.`,
    );
    session.state = 'MENU';
    await saveSession(session);
    return;
  }

  // Show the browse list and enter BROWSE state.
  session.state = 'BROWSE';
  session.learningState = {
    step: 'SELECT_COURSE',
    courseOptions: available,
    sections: [],
    sectionIndex: 0,
    browsing: true,  // flag so we know we are picking courses to enroll, not to learn
  };
  await saveSession(session);

  const list = available
    .map((c, i) => `${i + 1}️⃣ ${c.title} — ${c.cpdPoints} CPD pts, ${c.moduleCount} module${c.moduleCount !== 1 ? 's' : ''}`)
    .join('\n');

  await sendMessage(
    msg.from,
    `📚 *Available Courses*\n\nYou have no enrolled courses yet. Here are courses you can start:\n\n${list}\n\n_Reply with a number to enrol, or *menu* to go back._`,
  );
  return;
}
```

#### C3 — Add a `browsing` flag to `BotLearningState`

In `sessionManager.ts`, add `browsing?: boolean` to `BotLearningState`:

```ts
export interface BotLearningState {
  step: 'SELECT_COURSE' | 'SELECT_MODULE' | 'READING';
  browsing?: boolean;  // ← add this: true when picking courses to enroll in, not to learn
  courseId?: string;
  // ... rest of fields unchanged
}
```

#### C4 — Handle the BROWSE selection (enrol and then start learning)

In `handleLearn`, in the `SELECT_COURSE` step handler, add a check at the top of that block:

```ts
// ── SELECT_COURSE step ──
if (ls.step === 'SELECT_COURSE') {
  const options = ls.courseOptions ?? [];
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    await sendMessage(msg.from, `Please reply with a number between 1 and ${options.length}.`);
    return;
  }

  const course = options[idx];

  // If we are in browse mode (no enrollment yet), enrol first then proceed to modules.
  if (ls.browsing) {
    const phone = msg.from.replace('whatsapp:', '');
    const enrollmentId = await enrollInCourse(phone, course.id);
    if (!enrollmentId) {
      await sendMessage(msg.from, `⚠️ Could not enrol in *${course.title}* right now. Please try again.\n\nReply *menu* to go back.`);
      return;
    }
    await sendMessage(msg.from, `✅ Enrolled in *${course.title}*!\n\nLoading modules…`);
    ls.browsing = false;
    session.state = 'LEARNING';
  }

  // Rest of SELECT_COURSE logic (fetch modules, etc.) is unchanged below.
  ls.step = 'SELECT_MODULE';
  ls.courseId = course.id;
  ls.courseTitle = course.title;
  ls.courseOptions = undefined;
  await saveSession(session);

  // ... existing fetchModules logic unchanged
}
```

---

### Part D — Wire BROWSE state in `botRouter.ts`

Open `apps/whatsapp-bot/src/botRouter.ts`. Find where session states are dispatched.
The BROWSE state should be handled the same as LEARNING — both go to `handleLearn`:

```ts
case 'BROWSE':
case 'LEARNING':
  await handleLearn(msg, session);
  break;
```

If the router already has a `default` case that calls `handleMenu`, add the `'BROWSE'` case
explicitly before it so browse sessions aren't accidentally reset to menu.

---

## Acceptance criteria

- A WhatsApp user with zero enrollments types "1" (Learn) → bot shows a numbered list
  of up to 10 available courses with CPD points and module count.
- User replies "2" → bot confirms enrolment and immediately moves to the module picker
  for that course — no web login required.
- A user already enrolled in courses is unaffected — they continue to see their enrolled courses.
- `POST /api/bot/enroll` is idempotent: calling it twice with the same phone + courseId
  returns the existing enrollment without creating a duplicate.
- If no courses are available (all published, none match council), the bot sends a graceful
  "no courses right now" message and returns to menu.

---

## Do NOT change

- Do not change the existing `handleLearn` module/section reading flow.
- Do not change the quiz handler.
- Do not change any frontend files.
- Do not change the enrollment or courses routes (only `bot.ts` gets new endpoints).
