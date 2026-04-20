# Sprints 08–12 — Core Learner Features

> These 5 sprints build the full learner experience on the web: dashboard, course browser, player, quiz, payments, and certificates.

---

# Sprint 08 — Learner Dashboard

**Goal:** The learner dashboard — CPD progress ring, stat cards, in-progress courses, recent activity, and renewal countdown.

---

## Tasks

### T08.1 — CPD Progress Ring component

CREATE FILE: `apps/web/src/components/ui/ProgressRing.tsx`
```tsx
interface Props {
  value: number;   // 0–100 (percentage)
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export function ProgressRing({
  value, size = 160, strokeWidth = 12,
  label, sublabel, color = '#14b8a6',
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={value >= 100 ? '#16a34a' : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute text-center">
        {label && <div className="text-2xl font-bold text-slate-900">{label}</div>}
        {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
      </div>
    </div>
  );
}
```

---

### T08.2 — Stat Card component

CREATE FILE: `apps/web/src/components/ui/StatCard.tsx`
```tsx
import clsx from 'clsx';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: 'teal' | 'amber' | 'green' | 'red' | 'blue';
}

const ACCENT_CLASSES = {
  teal: 'bg-primary-100 text-primary-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
};

export function StatCard({ title, value, subtitle, icon, accent = 'teal' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', ACCENT_CLASSES[accent])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### T08.3 — useCPDPoints hook

CREATE FILE: `apps/web/src/hooks/useCPDPoints.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CPDSummary {
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  cycleYear: number;
  recordCount: number;
}

export function useCPDPoints(year?: number) {
  return useQuery<CPDSummary>({
    queryKey: ['cpd-summary', year],
    queryFn: () => api.get(`/api/points/summary${year ? `?year=${year}` : ''}`),
  });
}
```

---

### T08.4 — Full Learner Dashboard

EDIT FILE: `apps/web/src/pages/learner/Dashboard.tsx`
Replace with the full dashboard:
```tsx
import { Award, BookOpen, Calendar, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useCPDPoints } from '../../hooks/useCPDPoints';
import { StatCard } from '../../components/ui/StatCard';
import { ProgressRing } from '../../components/ui/ProgressRing';

export default function LearnerDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: cpd, isLoading } = useCPDPoints();

  const renewalDeadline = new Date(new Date().getFullYear(), 11, 31); // Dec 31
  const daysLeft = Math.ceil((renewalDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysLeft <= 60;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()}, {user?.fullName.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1">{new Date().toLocaleDateString('en-ZW', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stats + Progress Ring */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* CPD Ring — spans 1 col */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center gap-3">
          {isLoading ? (
            <div className="w-40 h-40 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <ProgressRing
              value={cpd?.percentComplete ?? 0}
              label={`${cpd?.totalPoints ?? 0}`}
              sublabel={`/ ${cpd?.requiredPoints ?? 12} pts`}
              color={isUrgent ? '#f59e0b' : '#14b8a6'}
            />
          )}
          <p className="text-sm font-medium text-slate-600">
            {cpd?.percentComplete === 100 ? '🎉 CPD Complete!' : 'CPD Progress'}
          </p>
        </div>

        {/* 3 stat cards */}
        <StatCard
          title="Points Earned"
          value={isLoading ? '–' : `${cpd?.totalPoints ?? 0}`}
          subtitle={`of ${cpd?.requiredPoints ?? 12} required`}
          icon={<Award size={20} />}
          accent="teal"
        />
        <StatCard
          title="Points Needed"
          value={isLoading ? '–' : Math.max(0, (cpd?.requiredPoints ?? 12) - (cpd?.totalPoints ?? 0))}
          subtitle="to complete renewal"
          icon={<BookOpen size={20} />}
          accent="amber"
        />
        <StatCard
          title="Days to Renewal"
          value={daysLeft}
          subtitle={`Deadline: ${renewalDeadline.toLocaleDateString('en-ZW')}`}
          icon={<Calendar size={20} />}
          accent={isUrgent ? 'red' : 'green'}
        />
      </div>

      {/* Placeholder for in-progress courses — Sprint 09 builds CourseCard */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Continue Learning</h2>
        <p className="text-slate-400 text-sm">Enrol in a course to see it here. <a href="/courses" className="text-primary-600 hover:underline">Browse courses →</a></p>
      </div>

      {/* WhatsApp shortcut */}
      <div className="bg-[#f0fdf4] border border-green-200 rounded-xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.098.544 4.071 1.494 5.785L.057 24l6.347-1.664A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.368l-.359-.213-3.72.976.993-3.63-.234-.372A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm">Learn on WhatsApp</p>
          <p className="text-slate-500 text-xs mt-0.5">No app needed. Get micro-lessons and earn CPD points via WhatsApp.</p>
        </div>
        <a href="https://wa.me/263771234567" target="_blank" rel="noopener noreferrer" className="ml-auto flex-shrink-0 bg-[#25D366] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#20ba5a] transition-colors">
          Start now →
        </a>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
```

---

## Validation Checklist (S08)
- [ ] Dashboard renders with correct greeting and date
- [ ] CPD progress ring shows correct % from API
- [ ] Stats cards show correct data
- [ ] Renewal countdown turns amber/red when ≤ 60 days
- [ ] Loading skeletons show while data fetches
- [ ] WhatsApp banner renders correctly

---

# Sprint 09 — Course Browser & Player

**Goal:** Course browser with filters, course cards, enrollment, and a functional video/reading player.

---

## Key Tasks

### T09.1 — Course Card component

CREATE FILE: `apps/web/src/components/course/CourseCard.tsx`
```tsx
import { BookOpen, Clock, Award, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Course } from '@nursepro/types';

const CATEGORY_COLOURS: Record<string, string> = {
  CLINICAL: 'bg-blue-100 text-blue-700',
  MANAGEMENT: 'bg-violet-100 text-violet-700',
  ETHICS: 'bg-orange-100 text-orange-700',
  RESEARCH: 'bg-teal-100 text-teal-700',
};

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link to={`/courses/${course.id}`} className="block group">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Thumbnail */}
        <div className="aspect-video bg-slate-100 relative overflow-hidden">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="text-slate-300" size={40} />
            </div>
          )}
          {/* Offline badge */}
          {course.modules?.some((m) => m.isOfflineReady) && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
              <Wifi size={10} /> Offline
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Category */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOURS[course.category] ?? 'bg-slate-100 text-slate-600'}`}>
            {course.category}
          </span>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 line-clamp-2 leading-snug text-sm">{course.title}</h3>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock size={12} />{course.estimatedMinutes} min</span>
            <span className="flex items-center gap-1"><Award size={12} />{course.cpdPoints} CPD pts</span>
          </div>

          {/* CTA */}
          <button className="w-full bg-primary-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-600 transition-colors">
            Enrol Now
          </button>
        </div>
      </div>
    </Link>
  );
}
```

### T09.2 — Courses page with filter sidebar
Create `apps/web/src/pages/learner/Courses.tsx` with:
- Left filter sidebar (category, difficulty, search input)
- Grid of CourseCard components
- useQuery fetching `/api/courses` with filter params
- Pagination buttons at bottom

### T09.3 — Course detail & player page
Create `apps/web/src/pages/learner/CoursePlayer.tsx` with:
- Left panel: module + section list with check states
- Main panel: video player (HTML5 video tag) or reading content (prose-styled)
- "Mark as Complete" button → updates progress via PATCH /api/enrollments/:id/progress

---

## Validation Checklist (S09)
- [ ] Course browser shows published courses from API
- [ ] Filters work (category, difficulty — sends query params)
- [ ] Course card shows thumbnail, category, points, duration
- [ ] Clicking "Enrol Now" calls POST /api/courses/:id/enroll
- [ ] Course player shows modules and sections in order
- [ ] Video plays in-browser; reading content renders HTML safely

---

# Sprint 10 — Quiz Engine (Web)

**Goal:** Full quiz-taking flow in the browser — question display, answer selection, submission, scoring, and CPD point crediting.

---

## Key Tasks

### T10.1 — Quiz API routes

CREATE FILE: `backend/src/routes/quizzes.ts`

Implement:
- `GET /api/quizzes/:id` — fetch quiz with questions (randomized if configured)
- `POST /api/quizzes/:id/attempt` — submit answers, calculate score, credit points if passed

The attempt endpoint:
1. Validates all question IDs belong to this quiz
2. Calculates score: (correct answers / total questions) × 100
3. If score >= passMark AND attempt count < attemptLimit:
   - Creates QuizAttempt record
   - Calls `creditPoints()` from CPD engine
4. Returns: `{ passed, score, pointsEarned, correctAnswers, feedback }`

### T10.2 — Quiz player component

CREATE FILE: `apps/web/src/components/course/QuizPlayer.tsx`

Implements:
- Question display one at a time
- Answer option buttons (radio group)
- Next/Previous navigation
- Submit button on last question
- Results screen: score circle, pass/fail message, points earned badge
- "Retake" button (if attempts remaining) or "Continue" on pass

---

## Validation Checklist (S10)
- [ ] Quiz fetches from API with questions in correct order
- [ ] Answer selection is saved in local state (not submitted until end)
- [ ] On submit: score calculated correctly server-side
- [ ] On pass: CPDRecord created, points credited, badge shown
- [ ] On fail: "Try again" shown, attempt count decremented
- [ ] At attempt limit: "Retake unavailable" message shown
- [ ] Correct/incorrect answers highlighted after submission

---

# Sprint 11 — Payments Integration

**Goal:** Paynow (EcoCash) and Stripe subscriptions. Learner can upgrade from Free to Standard.

---

## Key Tasks

### T11.1 — Payments service

CREATE FILE: `backend/src/services/payments.ts`

Implement two payment providers:
- `initiatePaynow(learnerId, tier, amount, email)` → returns payment URL
- `initiateStripe(learnerId, tier, amount, email)` → returns Stripe checkout session URL
- `handlePaynowWebhook(body)` → verifies payment, updates subscription
- `handleStripeWebhook(body, sig)` → verifies Stripe signature, updates subscription

When payment confirmed:
- Create/update Subscription record (tier, expiresAt = now + 1 year)
- Update User.subscriptionTier
- Create AuditLog entry

### T11.2 — Payment routes

CREATE FILE: `backend/src/routes/payments.ts`

- `POST /api/payments/initiate` — learner initiates payment, returns redirect URL
- `POST /api/payments/webhook/paynow` — Paynow callback (no auth)
- `POST /api/payments/webhook/stripe` — Stripe webhook (no auth, verified by sig)

### T11.3 — Subscription UI

Create `apps/web/src/pages/learner/Subscription.tsx`:
- Shows current tier + expiry date
- Pricing cards: Free (current) / Standard $5/yr / Diaspora $15/yr
- "Upgrade" button → calls `/api/payments/initiate` → redirect to payment URL
- Payment success redirect page

---

## Validation Checklist (S11)
- [ ] Paynow initiation returns a valid redirect URL
- [ ] Stripe initiation returns a Stripe checkout URL
- [ ] Webhook updates subscription tier in database
- [ ] User.subscriptionTier updates immediately after webhook
- [ ] Subscription page shows correct tier and expiry
- [ ] Free-tier learners see upgrade prompts for paid content

---

# Sprint 12 — Certificate Generation

**Goal:** PDF certificate generation, unique UUID, QR code verification, download.

---

## Key Tasks

### T12.1 — Certificate service

CREATE FILE: `backend/src/services/certificate.ts`

Implement:
- `generateCertificate(learnerId, cycleYear)`:
  1. Verify learner has reached requiredPoints for cycle year
  2. Check no certificate already exists for this learner + year
  3. Build PDF using PDFKit:
     - NursePro CPD header/logo placeholder
     - Learner full name (large, centered)
     - NCZ registration number
     - "has earned X CPD points in the [year] cycle"
     - Courses completed list
     - Certificate UUID
     - QR code (links to `{WEB_URL}/verify/{uuid}`)
     - Issue date
  4. Upload PDF to S3 (`certificates/{learnerId}/{uuid}.pdf`)
  5. Create Certificate record in database
  6. Return Certificate record

### T12.2 — Certificate routes

- `POST /api/certificates/generate` (LEARNER) — generates cert if eligible
- `GET /api/certificates` (LEARNER) — list learner's certificates
- `GET /api/certificates/verify/:uuid` (public) — returns certificate info for QR scan

### T12.3 — Certificate UI

Create `apps/web/src/pages/learner/Certificates.tsx`:
- List of earned certificates with issue date and cycle year
- "Download PDF" button per certificate
- "Generate Certificate" button if eligible and no cert yet
- Share/verify QR code display

---

## Validation Checklist (S12)
- [ ] Generating certificate when points >= required produces a PDF
- [ ] PDF uploads to S3 and CDN URL is stored in Certificate record
- [ ] Certificate has correct learner name, points, year, and UUID
- [ ] `GET /api/certificates/verify/:uuid` returns cert info without auth
- [ ] Learner cannot generate duplicate certificate for same year
- [ ] PDF download works from the UI

**Sign-off:** Claude Code validates S08–S12 as a group before moving to WhatsApp sprints.
