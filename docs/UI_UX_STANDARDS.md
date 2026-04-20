# NursePro CPD — UI/UX Standards & Anti-Pattern Reference

> **MANDATORY READING for every sprint from S13 onward.**  
> Every component you write, every page you build, every interaction you design must conform to this document.  
> If something is not covered here, match the closest pattern already established — do NOT invent new ones.

---

## 1. The Prime Directive

This platform must feel **calm, professional, and trustworthy** — the visual equivalent of a well-designed healthcare system.

- Calm: low visual noise, generous whitespace, muted slate backgrounds
- Professional: consistent typographic scale, tabular numbers, precise alignment
- Trustworthy: accessible contrast ratios, real feedback (toasts, loading states, errors), no broken flows

If you look at a page you just built and it looks like a tutorial template or a CRUD scaffold, it is **not done yet**.

---

## 2. Design Tokens (never deviate)

### Colours

| Token | Hex | Usage |
|---|---|---|
| `primary-500` | `#14b8a6` | Teal — primary buttons, active states, progress fill, links |
| `primary-600` | `#0d9488` | Teal hover state |
| `primary-50` / `primary-100` | light teal | Background tints, icon containers |
| `amber-500` | `#f59e0b` | Accent — warnings, secondary badges |
| `slate-900` | `#0f172a` | Body text, headings |
| `slate-600` | `#475569` | Secondary text |
| `slate-500` | `#64748b` | Tertiary / labels |
| `slate-400` | `#94a3b8` | Placeholder, disabled text |
| `slate-200` | `#e2e8f0` | Borders |
| `slate-100` | `#f1f5f9` | Subtle backgrounds |
| `slate-50` | `#f8fafc` | Page backgrounds |
| `green-500` | `#22c55e` | Success, completion, passed |
| `red-500` | `#ef4444` | Error, failed, destructive |
| `violet-500` | `#8b5cf6` | Creator portal accent |
| `blue-600` | `#2563eb` | NCZ portal accent |
| `rose-600` | `#e11d48` | Admin portal accent |

### Role accent bars (sidebar + portal cards)
```
LEARNER       → border-primary-500  (teal)
CONTENT_MANAGER → border-violet-500 (violet)
NCZ_OFFICER   → border-blue-600     (blue)
ADMIN         → border-rose-600     (rose)
```

### Spacing scale
Use Tailwind's default scale. Common values:
- Card padding: `p-5` (compact) or `p-6` (standard)
- Section gap: `space-y-6` or `gap-6`
- Page wrapper: `p-6 max-w-{4xl|5xl|7xl} mx-auto`
- Inner section: `space-y-4` or `space-y-5`

### Typography
| Usage | Classes |
|---|---|
| Page title | `text-2xl font-bold text-slate-900` |
| Section heading | `text-base font-semibold text-slate-900` or `text-lg font-semibold` |
| Card label | `text-sm font-semibold text-slate-900` |
| Body text | `text-sm text-slate-600` |
| Secondary / meta | `text-xs text-slate-500` |
| Monospace (UUIDs, codes) | `font-mono text-xs text-slate-400` |
| Numbers in stat cards | `text-3xl font-bold tabular-nums` |
| Progress labels | `text-xs font-medium tabular-nums` |

---

## 3. Component Library — what exists, how to use it

All components live in `apps/web/src/components/`. **Always use these — never re-invent them.**

### `StatCard` — `components/ui/StatCard.tsx`
```tsx
<StatCard
  title="Points Earned"
  value={42}
  subtitle="of 60 required"
  icon={<Award size={20} />}
  accent="teal"           // teal | amber | green | red | blue
  trend={{ label: "+3 this week", direction: "up" }}  // optional
/>
```
- Always use `tabular-nums` on values (built in)
- `trend` direction: `up` = green, `down` = red, `neutral` = slate
- Used in 3-col grids next to a `ProgressRing`

### `ProgressRing` — `components/ui/ProgressRing.tsx`
```tsx
<ProgressRing
  value={75}           // 0-100
  label="75"           // large center text
  sublabel="/ 100 pts" // small text below
  size={160}           // default
  strokeWidth={12}
  color="#14b8a6"      // turns green at 100%
/>
```
- **Animates from 0 on mount automatically** — do not add a second animation
- Turns `#16a34a` (green) automatically when `value >= 100`
- Always pair with a `p-6` card: `flex flex-col items-center justify-center gap-3`

### `CourseCard` — `components/course/CourseCard.tsx`
```tsx
<CourseCard course={{
  id, title, category, difficulty,
  thumbnailUrl, estimatedMinutes, cpdPoints,
  averageRating, reviewCount, creatorName,
  modules: [{ isOfflineReady: true }],
  enrollmentProgress: 45,  // present = shows progress bar, absent = shows Enrol button
}} />
```
- Use in `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` (grid view)
- For list view, use `ListCourseRow` pattern from `Courses.tsx`
- Always wrap grid in a skeleton loader (`animate-pulse h-72`) before data arrives

### `QuizPlayer` — `components/course/QuizPlayer.tsx`
```tsx
<QuizPlayer quizId="quiz-uuid" />
```
- Self-contained — handles loading, answering, submission, result, answer review
- Shows `toast.success` on pass, `toast.info` on fail
- Step dots above question for navigation
- Option labels use A/B/C/D letter badges

### `Toast` system — `components/ui/Toast.tsx`
```tsx
import { toast } from '../../components/ui/Toast';

toast.success('Certificate generated!');
toast.error('Could not save changes.');
toast.info('Quiz submitted.');
```
- `Toaster` is mounted once in `App.tsx` — do NOT add it again per page
- Auto-dismisses in 4.5s
- Never use `alert()` or inline error paragraphs for transient feedback — use `toast`
- Use `role="alert"` inline error divs only for form validation errors that persist

### `Badge` — `components/ui/Badge.tsx`
```tsx
<Badge variant="clinical">Clinical</Badge>
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
```
Variants: `default | success | warning | error | info | clinical | management | ethics | research`

### `EmptyState` — `components/ui/EmptyState.tsx`
```tsx
<EmptyState
  icon={<BookOpen size={28} />}
  title="No courses found"
  description="Try adjusting your filters."
  action={<Link to="/courses">Browse →</Link>}
/>
```
- Every page that shows a list **must** have an empty state
- Always center-aligned inside a white card
- Icon sits in a `w-16 h-16 rounded-full bg-slate-100` container
- Never just show "No data" plain text

---

## 4. Page Layout Patterns

### Standard page wrapper
```tsx
<div className="p-6 max-w-{xl} mx-auto space-y-6">
  {/* Page header */}
  <div className="flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Page Title</h1>
      <p className="text-sm text-slate-500 mt-1">Subtitle or description.</p>
    </div>
    <PrimaryActionButton />
  </div>

  {/* Content sections */}
</div>
```

Max widths by portal:
- Learner pages: `max-w-5xl` (focused) or `max-w-7xl` (wide with sidebar/filters)
- Creator portal: `max-w-6xl`
- NCZ portal: `max-w-6xl`
- Admin portal: `max-w-7xl`

### White card (standard container)
```tsx
<div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
```
- For interactive cards: add `hover:shadow-md transition-shadow`
- For important/featured content: `rounded-2xl shadow-lg`
- For section headers inside cards: `px-6 py-4 border-b border-slate-100`

### Dashboard stats grid (always 4-col on xl)
```tsx
<div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
  <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center">
    <ProgressRing ... />
  </div>
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
</div>
```

### Sidebar + content layout (filter pages)
```tsx
<div className="flex items-start gap-6">
  <aside className="w-64 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-5 sticky top-6 self-start">
    {/* filters */}
  </aside>
  <section className="flex-1 min-w-0">
    {/* results */}
  </section>
</div>
```

### Tab switcher
```tsx
<div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
  {tabs.map(t => (
    <button
      key={t.key}
      onClick={() => setTab(t.key)}
      className={clsx(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
        tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
      )}
    >
      {t.label}
    </button>
  ))}
</div>
```

---

## 5. Data State Patterns (loading / empty / error)

**Every single component that fetches data must handle all three states.** No exceptions.

### Loading skeleton
```tsx
// List items
<div className="space-y-4">
  {[1,2,3].map(i => (
    <div key={i} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
  ))}
</div>

// Grid cards
<div className="grid grid-cols-3 gap-6">
  {Array.from({length: 6}).map((_,i) => (
    <div key={i} className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
  ))}
</div>

// Stat numbers
<p className="text-3xl font-bold text-slate-300 animate-pulse">–</p>

// Inline skeleton (single row)
<div className="h-3 bg-slate-100 rounded w-2/3 animate-pulse" />
```

**Rules:**
- Skeleton must match the rough shape and size of the loaded content
- Use `animate-pulse` only on `bg-slate-100` or `bg-white border border-slate-200` containers
- Never show a blank white area with no skeleton — it looks broken

### Empty state
Always use `<EmptyState />` component. Never plain text. See section 3.

### Error state
```tsx
{error && (
  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold">Something went wrong</p>
      <p className="text-xs mt-0.5">{(error as Error).message}</p>
    </div>
  </div>
)}
```
- Import `AlertCircle` from `lucide-react`
- Always give enough context to understand what failed
- Add a "Try again" button if the user can act

---

## 6. Form Patterns

### Input (text, email, password)
```tsx
<div>
  <label htmlFor="field-id" className="block text-sm font-medium text-slate-700 mb-1.5">
    Field Label
  </label>
  <input
    id="field-id"
    type="text"
    placeholder="Placeholder"
    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm
               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
               transition-shadow placeholder:text-slate-400"
  />
</div>
```

### Select
```tsx
<select className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-slate-700">
```

### Textarea
```tsx
<textarea className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-24" />
```

### Submit button states
```tsx
<button
  type="submit"
  disabled={isPending}
  className="flex items-center justify-center gap-2 bg-primary-500 text-white text-sm font-semibold
             px-4 py-2.5 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors shadow-sm"
>
  {isPending ? (
    <>
      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      Saving…
    </>
  ) : 'Save changes'}
</button>
```

### Inline field error (validation)
```tsx
{errors.fieldName && (
  <p className="text-xs text-red-600 mt-1" role="alert">{errors.fieldName.message}</p>
)}
```

### Form rules
- **Every `<input>` must have a `<label>` with `htmlFor`** — required for accessibility
- Always use `id` matching the `htmlFor` value
- Use Zod + React Hook Form for validation (already installed)
- `onError`: call `toast.error(message)` for server errors, inline `role="alert"` for field errors
- `onSuccess`: call `toast.success(message)` then optionally redirect or close modal

---

## 7. Button Hierarchy

There should be at most **one primary action per page section.** Use the hierarchy below:

| Type | When to use | Classes |
|---|---|---|
| **Primary** | Main action (Save, Submit, Generate) | `bg-primary-500 text-white ... hover:bg-primary-600` |
| **Secondary** | Alternative action (Cancel, Export) | `bg-white border border-slate-200 text-slate-700 hover:bg-slate-50` |
| **Destructive** | Delete, remove | `bg-red-500 text-white hover:bg-red-600` |
| **Ghost** | Tertiary / inline | `text-primary-600 hover:underline text-sm` |
| **Icon only** | Compact action (must have `aria-label`) | `p-2 rounded-lg hover:bg-slate-100 text-slate-500` |

All buttons: `transition-colors` and focus state `focus:outline-none focus:ring-2 focus:ring-primary-500`

---

## 8. Table Patterns (for NCZ, Admin, Creator Analytics)

```tsx
<div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
  {/* Optional toolbar */}
  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
    <h2 className="text-sm font-semibold text-slate-900">Table Title</h2>
    <button className="...">Export CSV</button>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Column Name
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(row => (
          <tr key={row.id} className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4 text-slate-700">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Pagination */}
  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
    <span>{total} records</span>
    <div className="flex gap-2">
      <button onClick={prev} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">← Prev</button>
      <button onClick={next} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">Next →</button>
    </div>
  </div>
</div>
```

- Column headers: `text-xs font-semibold text-slate-500 uppercase tracking-wide`
- Row cells: `text-sm text-slate-700`, important values `font-medium text-slate-900`
- Status cells: use `<Badge>` component
- Always show row count in footer
- Always show empty state when zero rows

---

## 9. Modal Pattern

When you need a confirm dialog or a form overlay:

```tsx
function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 pb-5 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
```

Rules:
- Backdrop click closes the modal
- `aria-modal="true"` and `aria-labelledby` required
- Use `z-50`, never lower
- Max width: `max-w-lg` (form) or `max-w-2xl` (content-heavy)
- Only one modal open at a time

---

## 10. Progress Bars (inline)

```tsx
{/* Standard */}
<div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
  <div
    className="h-full bg-primary-500 rounded-full transition-all duration-700"
    style={{ width: `${percent}%` }}
  />
</div>

{/* With label */}
<div className="flex items-center gap-3">
  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${percent}%` }} />
  </div>
  <span className="text-xs font-medium text-slate-600 tabular-nums w-9 text-right">{percent}%</span>
</div>
```

Colours by context:
- In progress: `bg-primary-500`
- Completed: `bg-green-500`
- Urgent / overdue: `bg-amber-500`
- Failed: `bg-red-400`

---

## 11. Interaction & Animation Standards

| Element | Hover | Transition |
|---|---|---|
| Card | `hover:shadow-md` + `hover:-translate-y-0.5` | `transition-all duration-200` |
| Button | Darker shade (`-600`) | `transition-colors` |
| Nav link | `hover:bg-slate-100` | `transition-colors duration-150` |
| Progress fill | — | `transition-all duration-700` |
| ProgressRing | — | CSS `0.9s cubic-bezier(0.4,0,0.2,1)` (built-in) |
| Skeleton | `animate-pulse` | — |
| Modal appear | backdrop fade-in | handled by z-index stacking |

**Do NOT:**
- Animate text content
- Use `duration-1000` or longer for UI feedback
- Add `transform` + `transition` on every element — only interactive ones

---

## 12. Accessibility Checklist (every page)

- [ ] Every `<input>` has a `<label htmlFor="...">` with matching `id`
- [ ] Every icon-only button has `aria-label`
- [ ] Every image has `alt` attribute (empty `alt=""` for decorative images)
- [ ] Error messages use `role="alert"`
- [ ] Loading regions use `aria-busy="true"` or `role="status"`
- [ ] `ProgressRing` has `role="img" aria-label="{value}% complete"` (built-in)
- [ ] Toasts have `aria-live="polite"` (built-in in `Toaster`)
- [ ] Modals have `role="dialog" aria-modal="true" aria-labelledby`
- [ ] Focus rings visible: `focus:outline-none focus:ring-2 focus:ring-primary-500`
- [ ] Colour contrast: never use `text-slate-300` or lighter for readable text
- [ ] Tab order is logical — no invisible focus traps
- [ ] All `<select>` elements have `<label>` via `htmlFor` or `aria-label`

---

## 13. Portal-Specific Rules

### Creator Portal (violet accent)
- Course status badges: `DRAFT` = slate, `PENDING_REVIEW` = amber, `PUBLISHED` = green, `ARCHIVED` = red
- Use `<Badge>` for all status displays
- The course builder form uses TipTap for rich text — never a plain `<textarea>` for course body
- Always show module count and total estimated time in course cards
- Analytics charts use `recharts` — `AreaChart` for time series, `BarChart` for comparisons
- Export buttons trigger CSV download with `Content-Disposition` header handling

### NCZ Portal (blue accent)
- Learner table must have: Name, NCZ Reg No, Cadre, Points (cycle), Status (badge), Actions
- Search is debounced 300ms — never immediate API call on every keystroke
- Export CSV: `<a>` tag with `href="blob:..."` — never `window.location.href`
- Compliance status: `COMPLIANT` = green, `NON_COMPLIANT` = red, `PENDING` = amber
- Sync status card shows last sync time, record count, success/fail counts
- Never show personal PII (phone number, address) — only NCZ-relevant fields

### Admin Portal (rose accent)
- Stats at the top: total users, active learners, courses published, revenue MTD
- User management table: avatar initial + name + email + role badge + status + last seen + actions
- Course approvals: show submitted date, creator name, preview link, approve/reject buttons
- Audit log: timestamp | user | action | target | IP — read-only, paginated
- Settings page: never store config in component state — always API round-trip with `toast.success` on save
- AI provider switch: dropdown + "Test connection" button that pings the provider and shows latency

---

## 14. Common Mistakes — What Went Wrong in S08–S12 & How to Avoid Them

These are real issues found during the S01–S12 review. Do not repeat them.

### M01 — Stub pages shipped as "done"
**What happened:** `MyLearning.tsx`, `Points.tsx` were committed as stubs with "Coming next sprint."  
**Rule:** A page is not done until it renders real data, handles all three states (loading/empty/error), and looks like the design.  
**Fix pattern:** Before marking a task done, ask: "Can a learner actually use this right now?"

### M02 — Missing toast feedback
**What happened:** Mutations (`generateCertificate`, `enrol`, `submitQuiz`) completed silently — no success or error notification.  
**Rule:** Every `useMutation` must have both `onSuccess: () => toast.success(...)` and `onError: (err) => toast.error(err.message)`.  
**Never** rely on re-fetches alone to communicate that something worked.

### M03 — ProgressRing not animating on mount
**What happened:** Ring rendered at final value immediately — no animation — because offset was set on initial render.  
**Rule:** Always initialise display state at `circumference` (0%) and use `useEffect` + `requestAnimationFrame` to trigger the transition. This is already fixed in the component — don't override the internal `displayOffset` state.

### M04 — StatCard had no trend indicator
**What happened:** Values were static numbers with no direction signal — not enough information glance.  
**Rule:** Pass `trend` prop whenever the value is meaningful over time (points this week, compliance rate change, etc.). If you don't have the delta data yet, omit it — but don't design it out.

### M05 — CourseCard "Enrol Now" button shown inside a `<Link>`
**What happened:** The whole card was a `<Link to="/courses/:id">` wrapping a `<button>` — nested interactive elements.  
**Rule:** The card IS the link. The CTA text "Enrol Now" is a styled `<div>` inside the link, not a real `<button>`. Only when the card is NOT a link should you use an actual button.

### M06 — No view toggle or sort on list pages
**What happened:** Course browser only had a grid — no list mode, no sort order.  
**Rule:** Any page with more than ~8 items in a list must offer: (a) at least grid view, (b) a sort dropdown. See `Courses.tsx` for the reference implementation.

### M07 — Active filter chips missing
**What happened:** When filters were active there was no visual indication what was filtered.  
**Rule:** Active filters must render as dismissible chips below the toolbar. See `Courses.tsx` for pattern.

### M08 — Dashboard "Continue Learning" was a hardcoded placeholder
**What happened:** `Dashboard.tsx` had `<p>Enrol in a course to see it here.</p>` always, even when enrolled.  
**Rule:** Every data section on the dashboard fetches real data. Use the `useQuery` + empty state pattern.

### M09 — Certificates page looked like a plain list — not credentials
**What happened:** Cert cards were indistinguishable from any other content list item.  
**Rule:** Certificate cards must feel like credentials: gradient top bar, `ShieldCheck` icon, UUID in monospace, "Verified" badge, Download + Verify actions clearly separated.

### M10 — QuizPlayer lacked progress indicator and A/B/C/D option labels
**What happened:** Users couldn't tell which question they were on or distinguish options visually.  
**Rule:** Quiz must have: (a) step dots row above question, (b) A/B/C/D letter badge per option, (c) answered count `X/N answered` in header. These are all implemented — don't remove them.

### M11 — `<input>` elements missing `id` and `<label htmlFor>`
**What happened:** Accessibility audit (axe-core) flagged unlabelled inputs.  
**Rule:** Every `<input>`, `<select>`, `<textarea>` must have `id="unique-id"` and a `<label htmlFor="unique-id">`. If you can't show the label visually, use `sr-only`.

### M12 — Empty states missing or using plain text
**What happened:** When there was no data, pages showed nothing or a bare `<p>`.  
**Rule:** Always use `<EmptyState>` with an icon, title, description, and (where applicable) an action button. It is already built — import and use it.

### M13 — New components invented instead of using existing ones
**What happened:** Developers created ad-hoc `<div className="inline-flex items-center px-2 py-0.5...">` pill/badge patterns instead of using `<Badge>`.  
**Rule:** Before writing any UI primitive, check `components/ui/` first. The shared components are: `StatCard`, `ProgressRing`, `CourseCard`, `QuizPlayer`, `Badge`, `EmptyState`, `Toast`.

### M14 — `require('react')` inside a component file
**What happened:** A developer attempted to dynamically import hooks with `const { useState } = require('react')` inside a component body.  
**Rule:** Always import React hooks at the top of the file with ESM syntax: `import { useState, useEffect } from 'react';`. `require()` is CommonJS and is banned in this Vite/ESM project.

### M15 — No skeleton on initial load
**What happened:** Pages flashed a blank white card while data loaded.  
**Rule:** Every `isLoading` state must have a matching skeleton that matches the shape of the loaded content. If you see a white blank area on first load, the page is not done.

---

## 15. API Integration Rules

### Always use `api.get()` / `api.post()` from `lib/api.ts`
Never use raw `fetch()` or `axios`. The `api` helper:
- Attaches the JWT `Authorization` header automatically
- Handles 401 → token refresh → retry automatically
- Throws with a meaningful `Error.message` on API errors

### TanStack Query patterns
```tsx
// Read
const { data, isLoading, error } = useQuery<ResponseType>({
  queryKey: ['resource', param],          // always include params that affect the query
  queryFn: () => api.get(`/api/resource?param=${param}`),
});

// Write
const mutation = useMutation({
  mutationFn: (payload) => api.post('/api/resource', payload),
  onSuccess: (data) => {
    toast.success('Saved!');
    queryClient.invalidateQueries({ queryKey: ['resource'] });  // refresh affected queries
  },
  onError: (err: Error) => toast.error(err.message),
});
```

### staleTime
The `QueryClient` is configured with `staleTime: 5 * 60 * 1000` (5 minutes).  
Override per-query for real-time data: `staleTime: 30_000` (30s) for dashboards.

### queryKey structure
```
['resource']                  → list
['resource', id]              → single item
['resource', 'sub', param]    → filtered / nested
```
Always pass all variables that affect the query into the key so cache is properly scoped.

---

## 16. File & Import Conventions

```
apps/web/src/
├── components/
│   ├── layout/         ← AppShell, Sidebar, ProtectedRoute
│   ├── ui/             ← StatCard, ProgressRing, Badge, Toast, EmptyState
│   └── course/         ← CourseCard, QuizPlayer
├── pages/
│   ├── learner/        ← Dashboard, Courses, CoursePlayer, MyLearning, Points, Certificates, Profile, Subscription
│   ├── creator/        ← CourseBuilder, QuizBuilder, CreatorAnalytics, MediaLibrary
│   ├── ncz/            ← LearnerSearch, Compliance, SyncStatus
│   ├── admin/          ← AdminDashboard, UserManagement, CourseApprovals, AuditLog, Settings
│   └── VerifyCertificate.tsx (public)
├── store/
│   └── auth.store.ts   ← useAuthStore
├── hooks/
│   └── useCPDPoints.ts
└── lib/
    ├── api.ts
    └── ...
```

- One component per file
- File name matches the default export name exactly: `CourseCard.tsx` exports `CourseCard`
- `pages/` only contain page-level components (routed) — extract sub-components to `components/`
- Never import from `pages/` inside `components/` — only the reverse

---

## 17. Quick Checklist Before Marking Any Task Done

Before committing, run through this for every page/component you built:

- [ ] Handles **loading** state with skeleton
- [ ] Handles **empty** state with `<EmptyState>`
- [ ] Handles **error** state with styled error block
- [ ] All mutations call `toast.success` / `toast.error`
- [ ] All inputs have `id` + `<label htmlFor>`
- [ ] All icon-only buttons have `aria-label`
- [ ] Colours are from the design token list — no arbitrary hex values
- [ ] Text never overflows container (use `truncate` or `line-clamp-2`)
- [ ] Numbers use `tabular-nums`
- [ ] Page has correct max-width wrapper (`max-w-*xl mx-auto`)
- [ ] No nested `<a>` inside `<a>` or `<button>` inside `<a>`
- [ ] No `require()` — use ESM `import` only
- [ ] No hardcoded placeholder text like "Coming next sprint"
- [ ] No `alert()` — use `toast`
- [ ] Mobile: nothing breaks at 375px wide (even if mobile-first isn't the priority)
- [ ] TypeScript: `pnpm type-check` passes with zero errors

---

*NursePro CPD — UI/UX Standards v1.0*  
*Applies to: Sprints S13–S24. Maintained by Claude Code.*
