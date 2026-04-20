# NursePro CPD — Design System

> Version 1.0 | Web (Desktop + Tablet first, mobile PWA secondary) | Built on TailwindCSS

---

## 1. Brand Identity

### 1.1 Brand Positioning
NursePro CPD is a **professional, trusted, and empowering** platform for healthcare workers. The design language reflects:
- **Trust** — clean lines, structured layouts, no clutter
- **Empowerment** — progress-forward UI, celebration of milestones
- **Accessibility** — high contrast, readable typography, never decorative-first

### 1.2 Naming & Domain
- Product name: **NursePro CPD**
- Tagline: **Learn. Earn. Advance.**
- Domain: `nursepro.co.zw`

---

## 2. Colour Palette

All colours are defined as Tailwind CSS custom tokens in `tailwind.config.ts`.

### 2.1 Primary — Teal (trust, healthcare, professionalism)

| Token | Hex | Usage |
|---|---|---|
| `primary-50` | `#f0fdfa` | Light backgrounds, hover tints |
| `primary-100` | `#ccfbf1` | Subtle section backgrounds |
| `primary-200` | `#99f6e4` | Input borders on focus |
| `primary-400` | `#2dd4bf` | Secondary buttons, icons |
| `primary-500` | `#14b8a6` | **Main CTA buttons** |
| `primary-600` | `#0d9488` | Hover state on primary buttons |
| `primary-700` | `#0f766e` | Active state, dark accent |
| `primary-900` | `#134e4a` | Dark teal (sidebar header) |

### 2.2 Accent — Amber (progress, achievement, milestones)

| Token | Hex | Usage |
|---|---|---|
| `accent-400` | `#fbbf24` | Point badges, progress rings |
| `accent-500` | `#f59e0b` | **Star ratings, certificate icon** |
| `accent-600` | `#d97706` | Hover on accent elements |

### 2.3 Neutrals — Slate (content, text, structure)

| Token | Hex | Usage |
|---|---|---|
| `slate-50` | `#f8fafc` | Page background |
| `slate-100` | `#f1f5f9` | Card backgrounds, table rows |
| `slate-200` | `#e2e8f0` | Dividers, borders |
| `slate-400` | `#94a3b8` | Placeholder text, disabled |
| `slate-600` | `#475569` | Secondary text |
| `slate-700` | `#334155` | Body text |
| `slate-900` | `#0f172a` | **Headings, primary text** |

### 2.4 Semantic Colours

| Name | Hex | Token | Usage |
|---|---|---|---|
| Success | `#16a34a` | `green-600` | Passed quiz, completed module |
| Warning | `#ca8a04` | `yellow-600` | Renewal deadline approaching |
| Error | `#dc2626` | `red-600` | Failed quiz, sync error |
| Info | `#2563eb` | `blue-600` | Tips, notifications |

### 2.5 Role-Specific Accent Bars (sidebar top border)

| Role | Colour |
|---|---|
| Learner | `primary-500` (teal) |
| Creator | `violet-500` |
| NCZ Officer | `blue-600` |
| Admin | `rose-600` |

---

## 3. Typography

### 3.1 Font Stack

```css
/* Headings */
font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;

/* Body */
font-family: 'Inter', system-ui, sans-serif;

/* Monospace (code, IDs, certificate numbers) */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

Load from Google Fonts: `Inter` (weights 400, 500, 600, 700).

### 3.2 Type Scale

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 400 | 1.5 | Labels, meta |
| `text-sm` | 14px | 400 | 1.5 | Secondary body, table cells |
| `text-base` | 16px | 400 | 1.6 | **Primary body text** |
| `text-lg` | 18px | 500 | 1.5 | Card titles, sub-headings |
| `text-xl` | 20px | 600 | 1.4 | Section headings |
| `text-2xl` | 24px | 700 | 1.3 | Page titles |
| `text-3xl` | 30px | 700 | 1.2 | Dashboard hero numbers |
| `text-4xl` | 36px | 800 | 1.1 | Marketing hero |

### 3.3 Rules
- Never use fewer than 2 levels of hierarchy on a screen
- Headings: always `slate-900`
- Body: `slate-700`
- Secondary/meta text: `slate-500`
- Never use pure `#000000` black for text

---

## 4. Spacing & Layout

### 4.1 Base Unit
`4px` (1 Tailwind unit). All spacing should be multiples of 4px.

### 4.2 Container Widths

| Breakpoint | Min | Max container |
|---|---|---|
| `sm` | 640px | 100% |
| `md` | 768px | 100% |
| `lg` | 1024px | 1024px |
| `xl` | 1280px | 1280px |
| `2xl` | 1536px | 1400px |

### 4.3 Page Layout (Authenticated App Shell)

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main content area            │
│  ┌──────────────────┐   │  ┌─────────────────────────┐  │
│  │ Logo + Role badge│   │  │ Top bar (breadcrumbs,   │  │
│  │                  │   │  │ user menu, notifications)│  │
│  │ Nav items        │   │  ├─────────────────────────┤  │
│  │                  │   │  │                         │  │
│  │                  │   │  │  Page content           │  │
│  │                  │   │  │  (max-w-7xl, p-6)        │  │
│  │                  │   │  │                         │  │
│  │ ────────────────│   │  │                         │  │
│  │ User card        │   │  │                         │  │
│  └──────────────────┘   │  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Grid System
- Use CSS Grid with 12 columns for page layouts
- Cards in dashboards: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` (3-up)
- Stats row: `grid-cols-2 lg:grid-cols-4` (4-up)
- Gap: always `gap-6` (24px)

---

## 5. Component Library

### 5.1 Buttons

**Primary Button** (main CTA)
```
bg-primary-500 text-white font-semibold
px-4 py-2.5 rounded-lg
hover:bg-primary-600 active:bg-primary-700
focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
disabled:opacity-40 disabled:cursor-not-allowed
transition-colors duration-150
```

**Secondary Button**
```
bg-white text-primary-600 border border-primary-300 font-medium
px-4 py-2.5 rounded-lg
hover:bg-primary-50
```

**Destructive Button**
```
bg-red-600 text-white font-semibold px-4 py-2.5 rounded-lg
hover:bg-red-700
```

**Ghost Button** (icon-only or tertiary actions)
```
text-slate-600 hover:text-slate-900 hover:bg-slate-100
px-3 py-2 rounded-lg
```

**Sizes:** `sm` (h-8 text-sm px-3), `md` (h-10 text-sm px-4 — default), `lg` (h-12 text-base px-6)

### 5.2 Cards

**Base Card**
```
bg-white rounded-xl border border-slate-200 shadow-sm
p-6
hover:shadow-md transition-shadow duration-200
```

**Stat Card** (dashboard numbers)
```
bg-white rounded-xl border border-slate-200 p-6
[icon top-right in colored circle]
[large number h2 slate-900]
[label text-sm text-slate-500]
[trend indicator: +5% green or -2% red]
```

**Course Card**
```
bg-white rounded-xl border border-slate-200 overflow-hidden
[thumbnail 16:9 ratio top]
[content: p-4]
  [category pill]
  [title font-semibold text-slate-900]
  [creator avatar + name]
  [points badge + duration]
  [progress bar if enrolled]
  [CTA button]
```

### 5.3 Form Elements

**Text Input**
```
w-full px-3 py-2.5 rounded-lg
border border-slate-300 bg-white text-slate-900
placeholder:text-slate-400
focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
disabled:bg-slate-50 disabled:text-slate-400
text-sm
```

**Select**  Same as text input + chevron icon right.

**Label**: `text-sm font-medium text-slate-700 mb-1`

**Error message**: `text-xs text-red-600 mt-1`

**Field group spacing**: `space-y-4` within a form, `space-y-6` between sections.

### 5.4 Progress & Points Components

**CPD Progress Ring** (learner dashboard hero)
- SVG circle ring, 160px × 160px
- Track colour: `slate-200`
- Fill colour: `primary-500` (or amber if within 30 days of deadline)
- Center: large points number + "/ 12 pts" label
- Animated stroke-dashoffset on mount

**Points Badge**
```
inline-flex items-center gap-1
bg-amber-50 text-amber-700 border border-amber-200
text-xs font-semibold px-2 py-0.5 rounded-full
[star icon left]
"12 CPD pts"
```

**Progress Bar** (course/module completion)
```
h-2 rounded-full bg-slate-200
[fill: bg-primary-500, width = % complete]
[label: "64% complete" text-xs text-slate-500 mt-1]
```

### 5.5 Navigation

**Sidebar Nav Item**
```
flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
text-slate-600 hover:bg-slate-100 hover:text-slate-900
[Active: bg-primary-50 text-primary-700 font-medium border-l-2 border-primary-500]
```

**Sidebar Sections**: grouped with `text-xs uppercase tracking-wider text-slate-400 px-3 mb-1 mt-4` headers.

**Top Bar**: `h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between`

### 5.6 Tables (NCZ portal, admin lists)

```
min-w-full text-sm
[thead: bg-slate-50 text-xs uppercase tracking-wider text-slate-500]
[th: px-4 py-3 text-left font-medium]
[td: px-4 py-3 text-slate-700 border-b border-slate-100]
[tr hover: bg-slate-50]
[sticky header on scroll]
```

### 5.7 Badges / Pills

```
inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
```

| Status | Colour |
|---|---|
| Published | `bg-green-100 text-green-700` |
| Under Review | `bg-yellow-100 text-yellow-700` |
| Draft | `bg-slate-100 text-slate-600` |
| Archived | `bg-slate-100 text-slate-400` |
| Free | `bg-blue-100 text-blue-700` |
| Standard | `bg-primary-100 text-primary-700` |

### 5.8 Modals & Sheets

- Backdrop: `bg-black/50 backdrop-blur-sm`
- Panel: `bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 mx-4`
- Animation: fade-in + scale from 95% to 100%
- Side sheet (for media library, settings): slides from right, `max-w-xl w-full`

### 5.9 Toast Notifications

Position: `top-right`, stacked.

```
flex items-start gap-3 bg-white border rounded-xl shadow-lg p-4 min-w-72
[icon: coloured circle left]
[title: font-medium text-slate-900]
[message: text-sm text-slate-500]
[auto-dismiss: 4 seconds]
```

---

## 6. Iconography

Use **Lucide React** icons throughout (consistent stroke style, 20px default size).

Key icons by context:

| Context | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Courses | `BookOpen` |
| My Points | `Award` |
| Certificates | `FileCheck` |
| Profile | `User` |
| Analytics | `BarChart2` |
| Settings | `Settings` |
| Admin Users | `Users` |
| NCZ Sync | `RefreshCw` |
| Payments | `CreditCard` |
| Quiz | `ClipboardList` |
| Video | `Play` |
| Audio | `Headphones` |
| Download | `Download` |
| Offline | `WifiOff` |
| WhatsApp | custom SVG (WhatsApp green `#25D366`) |
| AI Tutor | `Sparkles` |
| Warning | `AlertTriangle` |
| Success | `CheckCircle2` |

---

## 7. Page Designs — Key Screens

### 7.1 Learner Dashboard

**Layout:** 2-column (content 8 cols + sidebar 4 cols on xl)

**Top section:**
- Greeting: "Good morning, [Name]" + date
- 3 stat cards: Points Earned / Points Needed / Days to Renewal
- CPD Progress Ring (hero element)

**Main content:**
- Continue Learning section: horizontal card carousel of in-progress courses
- Recommended Courses (AI-powered): 3-up grid
- Recent Activity feed: timeline list

**Right sidebar:**
- Renewal countdown widget
- WhatsApp shortcut banner (pale green, WhatsApp icon)
- Quick actions: Download Certificate, View Report

---

### 7.2 Course Browser

**Layout:** Full-width with left filter sidebar (260px) + course grid

**Filters (left):**
- Search box (top)
- Category (CPD category chips)
- Difficulty (pills)
- Cadre (checkbox list)
- Language
- Duration
- CPD Points range slider

**Course grid:**
- Default: `grid-cols-3` (desktop), `grid-cols-2` (tablet)
- View toggle: grid / list
- Sort: Most Popular / Newest / Highest Rated / Most Points

**Course card features:**
- Thumbnail (16:9)
- Category pill (coloured by CPD category)
- Title + subtitle
- Creator chip (avatar + name)
- Points badge (amber)
- Duration
- Rating stars
- Enroll / Continue / Completed button
- Offline available icon (if offline-ready)

---

### 7.3 Course Player

**Layout:** Video/content left (70%) + progress sidebar right (30%)

**Content area:**
- Video player (16:9, controls, speed selector, fullscreen)
- Below: Module title + description
- Reading content: max-width prose, well-typeset
- PDF viewer: embedded with download option

**Progress sidebar:**
- Module list with check states (not started / in-progress / complete / locked)
- Active module highlighted
- CPD points on completion callout

**Bottom bar:** Previous / Next navigation + "Mark complete" button

---

### 7.4 Quiz Screen

**Layout:** Focused, centered, max-width 720px

**Header:**
- Quiz title + timer (if timed)
- Progress: "Question 3 of 10" + progress bar
- Points possible

**Question area:**
- Question text (text-xl)
- Optional image (16:9, rounded)
- Answer options: vertical radio list
  - Default: `border border-slate-200 bg-white rounded-lg px-4 py-3`
  - Selected: `border-primary-500 bg-primary-50`
  - Correct (after submit): `border-green-500 bg-green-50 text-green-800`
  - Incorrect: `border-red-400 bg-red-50 text-red-800`

**Navigation:** Previous / Next / Submit

**Results screen:**
- Score circle (large percentage)
- Pass/fail message with celebration animation on pass
- Points earned badge
- Review answers / Retake / Continue

---

### 7.5 Creator Portal — Course Builder

**Layout:** Full-screen editor with left course outline panel (280px) + editor canvas

**Outline panel:**
- Course title (editable inline)
- Module list: drag handles, add/remove
- Section list per module: add VIDEO / READING / AUDIO / QUIZ

**Canvas:**
- Context-sensitive editor per selected section
- Video: drop zone + YouTube URL input
- Reading: TipTap rich text editor
- Quiz: question builder (add questions, options, set correct answer)

**Top bar:**
- Save (auto-save with indicator)
- Preview
- Submit for Review / Publish button

---

### 7.6 Admin Dashboard

**Layout:** Full-width, 4-stat hero row + 2 chart panels + table

**Hero stats:**
- Total Learners / Active Subscriptions / Revenue This Month / Courses Live

**Charts:**
- Monthly Active Learners (line chart)
- Points Distributed by Month (bar chart)
- Subscription Breakdown (donut chart)

**Tables:**
- Pending Course Approvals (action: Approve / Reject)
- Recent User Registrations
- NCZ Sync Status

---

### 7.7 NCZ Portal

**Layout:** Clean, report-focused. No decorative elements.

**Search panel:**
- Registration number, name, institution, district, province, cadre — all inline filters
- Big "Search" button
- Export CSV / Export PDF buttons (always visible)

**Results table:**
- Learner name, reg number, institution, cadre, points (current cycle), compliance status
- Row click → expand learner detail panel (slide-in from right)

**Compliance summary:**
- Three cards at top: Total Registered / Compliant / Non-Compliant
- Progress bar showing % compliance

---

## 8. Motion & Animation

- **Principle:** Motion is functional, not decorative. It provides feedback and orientation.
- Default transition: `transition-all duration-150 ease-in-out`
- Page transitions: fade (`opacity 0→1`, 200ms)
- Modal: scale + fade (`scale-95→100 opacity-0→1`, 150ms)
- Toast: slide from right (`translateX(100%)→0`, 200ms)
- Progress bars: animated fill on mount (500ms ease-out)
- CPD ring: animated stroke on mount (800ms ease-out)
- Skeleton loaders: pulse animation (`animate-pulse`) on all loading states

---

## 9. Accessibility Standards

- **Target:** WCAG 2.1 AA
- All interactive elements have visible focus rings (`focus:ring-2 focus:ring-primary-500`)
- Minimum colour contrast: 4.5:1 for body text, 3:1 for large text
- All images have `alt` attributes
- All form inputs have associated `<label>` elements
- Keyboard navigation: all flows completable without mouse
- Screen reader: all icon-only buttons have `aria-label`
- Reduce motion: `@media (prefers-reduced-motion)` respected — disable animations

---

## 10. Tailwind Config Summary

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        accent: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
        modal: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

export default config;
```

---

## 11. File Structure for UI Components

```
apps/web/src/components/
├── ui/
│   ├── Button.tsx           ← variant, size, loading state
│   ├── Input.tsx            ← label, error, hint slots
│   ├── Select.tsx
│   ├── Textarea.tsx
│   ├── Badge.tsx            ← status, tier, category pills
│   ├── Card.tsx             ← base card shell
│   ├── Modal.tsx            ← backdrop + panel + portal
│   ├── Sheet.tsx            ← right-side panel
│   ├── Toast.tsx            ← toast provider + hook
│   ├── Skeleton.tsx         ← loading placeholders
│   ├── Avatar.tsx           ← user avatar with fallback initials
│   ├── ProgressBar.tsx      ← with label and colour variants
│   ├── ProgressRing.tsx     ← SVG CPD ring
│   ├── PointsBadge.tsx      ← amber star badge
│   ├── Tooltip.tsx
│   ├── Dropdown.tsx         ← menu trigger + items
│   ├── Table.tsx            ← base table with sort and pagination
│   └── EmptyState.tsx       ← empty content placeholders
├── layout/
│   ├── AppShell.tsx         ← sidebar + topbar wrapper
│   ├── Sidebar.tsx          ← role-aware nav
│   ├── TopBar.tsx
│   └── PageHeader.tsx       ← breadcrumb + title + actions slot
├── course/
│   ├── CourseCard.tsx
│   ├── CourseGrid.tsx
│   ├── CourseFilters.tsx
│   ├── VideoPlayer.tsx
│   ├── QuizPlayer.tsx
│   ├── ProgressSidebar.tsx
│   └── CertificateCard.tsx
└── charts/
    ├── PointsRing.tsx
    ├── ActivityChart.tsx    ← recharts line chart
    ├── CompletionChart.tsx  ← recharts bar chart
    └── ComplianceDonut.tsx  ← recharts pie chart
```

---

*NursePro CPD Design System v1.0 — April 2026*
