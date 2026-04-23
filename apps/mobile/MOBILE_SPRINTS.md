# ZimHealth Mobile — Agent Build Plan

> **React Native + Expo 52 · NativeWind v4 · TanStack Query v5 · Zustand v5**  
> API: shared `@zimhealth/backend` — all endpoints `/api/*`  
> Design authority: `docs/UI_UX_STANDARDS.md` (read it before writing a single line of UI)

---

## PART 1 — UI/UX Laws

These rules are **non-negotiable**. Every screen, every component, every interaction must pass all of them. If a rule conflicts with a shortcut, the rule wins.

---

### Law 1 — The Three-State Rule

Every component that fetches remote data must render three states. No exceptions, no partial implementations.

```
LOADING  →  skeleton placeholders that match the shape of the real content
ERROR    →  friendly message + retry action (never just "Error")
SUCCESS  →  the actual data
```

**Loading skeletons must match real content shape:**
- A course card skeleton is `h-24 rounded-3xl bg-slate-200` — not a full-screen spinner
- A profile field skeleton is `h-4 w-32 rounded bg-slate-200` — not a blank white box
- Use `opacity-50 animate-pulse` on the skeleton container — never on real content

**Never show a blank white screen.** If data is missing, show an empty state with an icon, a title, and an action.

---

### Law 2 — Spacing Discipline

Mobile screens have limited space. Every pixel of spacing must be intentional.

| Context | Value |
|---|---|
| Screen horizontal padding | `px-4` (16pt) — always |
| Card internal padding | `p-4` (compact) or `px-5 py-4` (standard) |
| Gap between cards in a list | `gap-y-3` or `gap-y-4` |
| Gap between form fields | `gap-y-4` |
| Section title to content | `mb-3` |
| Screen top padding (below header) | `pt-4` |
| Screen bottom padding (above tab bar) | `pb-8` |

Never use arbitrary pixel values. Stick to Tailwind's scale: 1, 2, 3, 4, 5, 6, 8, 10, 12.

---

### Law 3 — Typography Hierarchy

Every screen must have exactly one visual hierarchy. Use these and nothing else:

| Level | Class | When |
|---|---|---|
| Screen title | `text-2xl font-bold text-slate-900` | Main heading per screen — once |
| Section heading | `text-sm font-bold text-slate-700` | Groups of cards / sections |
| Card title | `text-sm font-semibold text-slate-900` | Primary content label |
| Body text | `text-sm text-slate-600 leading-6` | Paragraphs, descriptions |
| Meta / secondary | `text-xs text-slate-400` | Dates, counts, subtitles |
| Positive metric | `text-xl font-bold text-slate-900` | CPD points, stats |
| Active/link text | `text-sm font-semibold text-primary-600` | Tappable secondary text |

**Never:**
- Use `font-medium` — it is invisible at small sizes on mobile. Use `font-semibold` or `font-bold`
- Mix two font-weights in a single line of the same semantic level
- Use `text-slate-800` — it is too close to `text-slate-900` to be intentional

---

### Law 4 — Colour Discipline

The palette is fixed. Do not add colours, do not use opacity hacks to invent new shades.

| Situation | Colour |
|---|---|
| Primary action button | `bg-primary-500` |
| Active/selected state | `bg-primary-500` text or border |
| Icon containers | `bg-primary-100` with teal icon |
| Hero card background | `bg-primary-500` |
| Page background | `bg-slate-50` |
| Card background | `bg-white` |
| Secondary card | `bg-slate-50 border border-slate-100` |
| Destructive action | `bg-red-500` |
| Success badge | `bg-green-100 text-green-700` |
| Warning / accent | `bg-amber-100 text-amber-700` |
| Offline indicator | `bg-amber-400` — amber, not yellow |

**Never use raw hex values.** If the colour doesn't exist as a Tailwind token, it doesn't belong here.

---

### Law 5 — Touch Target Size

Every tappable element must be at least 44×44pt. This is a healthcare app — professionals use it with gloved hands, in dim lighting, tired at the end of a shift.

- Small icon buttons: add `hitSlop={12}` or `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}`
- Small text links: add `hitSlop={8}`
- Chip/tag items: minimum `py-2.5 px-4`
- Tab bar icons are handled by React Navigation defaults — do not override

---

### Law 6 — Card Design

Cards are the primary visual container on mobile. All cards must follow this pattern:

```tsx
// Standard card
<Card className="gap-y-3">
  <Badge label="CLINICAL" variant="teal" />
  <Text className="text-sm font-semibold text-slate-900">{title}</Text>
  <Text className="text-xs text-slate-400">{meta}</Text>
</Card>
```

Rules for cards:
- Always `rounded-3xl` — never `rounded-xl` or `rounded-2xl` on cards
- Always `shadow-sm` — never `shadow-md` or higher (mobile shadows look heavy)
- White background only — `bg-white` — unless using `Card variant="teal"` or `variant="slate"`
- Internal padding: `p-4` minimum — never `p-2` or `p-3`
- Never nest a card inside a card

---

### Law 7 — Buttons

```tsx
// DO
<Button label="Enrol Now" onPress={fn} />                    // full width primary
<Button label="Cancel" onPress={fn} variant="ghost" />       // ghost action
<Button label="Delete" onPress={fn} variant="danger" />      // destructive

// DON'T
<Pressable style={{ backgroundColor: '#14b8a6' }}>           // never raw styles
<TouchableOpacity onPress={fn}>                              // use Pressable only
```

Rules:
- One primary (teal) button per screen — never two
- Destructive actions (`variant="danger"`) always require a confirmation `Alert`
- Never disable a button without showing the user why (validation hint below form field)
- Loading state: `loading={mutation.isPending}` — never manually toggle visibility

---

### Law 8 — Forms

```tsx
// Every field: label above, hint or error below
<Input
  label="NCZ registration number"
  value={nczReg}
  onChangeText={setNczReg}
  placeholder="e.g. RN-12345"
  hint="Found on your NCZ licence card"
  error={errors.nczReg}
/>
```

Rules:
- `KeyboardAvoidingView` wrapping every form screen (behavior `padding` on iOS, `height` on Android)
- `keyboardShouldPersistTaps="handled"` on every `ScrollView` containing a form
- Never show a submit button until the form is ready to submit (disable with reason)
- Optional fields marked with "(optional)" in the label — never hide them

---

### Law 9 — Empty States

Every list screen must have a designed empty state. A blank white screen is not acceptable.

```tsx
<View className="items-center py-20 px-8">
  <Ionicons name="book-outline" size={48} color="#cbd5e1" />
  <Text className="text-base font-bold text-slate-700 mt-4 text-center">
    No courses yet
  </Text>
  <Text className="text-sm text-slate-400 mt-2 text-center leading-5">
    New courses are published regularly. Check back soon or browse the full catalogue.
  </Text>
  <Button label="Browse Courses" onPress={fn} className="mt-6" />
</View>
```

Structure: icon (slate-300) → bold title → descriptive body → optional action button

---

### Law 10 — Feedback and Toasts

This app has no toast library yet. Until one is added in Sprint 5, use `Alert.alert()` for errors and success confirmations. When adding the toast library:
- Success: green top-of-screen banner, auto-dismiss 3s
- Error: red, auto-dismiss 5s
- Info: slate, auto-dismiss 3s
- Never use `Alert.alert()` for transient success (only for confirmations like "Are you sure?")

---

### Law 11 — Navigation Transitions

React Navigation defaults are correct. Do not override them.

- **Stack screens** slide right (push) and left (pop) — correct
- **Modal screens** (quiz result, confirmation) slide up — set `presentation: 'modal'`
- **Bottom tabs** instant switch — correct, no animation override
- Never add custom `gestureEnabled: false` without a hard technical reason
- Back buttons: always visible on nested stack screens — never hide the back button

---

### Law 12 — Offline Indicators

When `isOnline === false`, the following must be visible:

1. An amber `OfflineBanner` at the top of the screen (below safe area)
2. Cached data is shown with a `Badge label="Offline" variant="amber"` near the header
3. Actions that require connectivity are disabled with text "Available when online"

Never fail silently when offline.

---

## PART 2 — Visual Language

### What makes this app exciting (not complex)

The ZimHealth mobile app should feel like a best-in-class health/productivity app — think Headspace or Duolingo in terms of visual quality, but grounded in the professional trust of a healthcare tool. Exciting through **clarity and confidence**, not through animations, gradients, or decorative complexity.

**The hero moment on every screen is the content itself.** Teal accents draw the eye to the most important action. White cards lift content off the slate-50 background. The teal header on the Login screen is the brand statement — it appears nowhere else in the same weight.

**Consistency is the feature.** Every course card looks the same. Every badge works the same. Every empty state has the same structure. A health professional who uses the app twice a week should never have to think about where to tap.

### What to avoid

- No gradients (except the solid `bg-primary-500` hero areas)
- No blur effects, frosted glass, or background overlays (except modals)
- No heavy drop shadows (`shadow-lg` or higher)
- No animated progress rings or SVG charts before Sprint 8
- No custom font sizes outside the typography scale
- No decorative illustrations — icons only
- No more than two font weights on one screen (`font-semibold` for labels, `font-bold` for headings)
- No colour outside the defined palette

---

## PART 3 — Screen Specs

### Login Screen
- **Top 40%:** solid `bg-primary-500`, vertically centered: emoji icon (🏥) in `bg-white/20 rounded-3xl` container, "ZimHealth" in `text-4xl font-bold text-white`, "CPD Platform · Zimbabwe" in `text-primary-200`
- **Bottom 60%:** white card `rounded-t-[2.5rem]` (extra rounded top corners only), slides up to fill the rest
- Inside card: "Welcome back" title, email + password inputs, forgot password link (right-aligned), Login button, "OR" divider with `h-px bg-slate-200`, WhatsApp button (secondary variant), register link
- Error: red `bg-red-50 border border-red-200` banner above Login button
- No scrolling unless keyboard pushes content — use `KeyboardAvoidingView`

### Register Screen
- White background (not teal hero — this is a focused task screen)
- Header row: back arrow + "Create account" title (centered) + step dots (right)
- Step dots: active step = `bg-primary-500 w-8 h-2.5 rounded-full`; inactive = `bg-slate-200 w-2.5`
- Step 1: fullName, email, password, phone — "Next" button disabled until all required fields valid
- Step 2: cadre picker (chip buttons, wrapping flex-row), nczReg, institution, province — "Create Account" button
- Cadre chips: selected = `bg-primary-500 border-primary-500 text-white`; unselected = `bg-white border-slate-200 text-slate-700`
- Both steps inside `ScrollView` with `keyboardShouldPersistTaps="handled"`

### Dashboard Screen
- `SafeAreaView bg-slate-50` full screen
- **Greeting header:** `bg-primary-500` section with user first name, "👋", cadre badge (white variant), teal logo icon top-right
- Below header, `px-4 -mt-4 gap-y-4` pulls content up to overlap the teal
- **CPD Progress card:** white card, progress bar (`bg-primary-500` fill, `bg-slate-100` track), points/target right-aligned, status text below
- **Quick stats row:** 3 equal-width white cards with Ionicons icon, metric, label — completed courses / total points / streak
- **Continue Learning card:** only shown when enrollment exists; play icon, course title, CPD points, chevron
- **Recommendations:** section heading row (text + refresh icon button), horizontal FlatList of 48-wide course cards, `isProfileBased` badge below heading
- Pull-to-refresh on outer ScrollView

### Courses Screen
- `SafeAreaView bg-slate-50` (bottom edge only — header handled by navigator)
- Search bar full width: `bg-white border border-slate-200 rounded-2xl` with search icon and clear button
- Category chips in `ScrollView horizontal` below search bar
- Course cards in `FlatList` with `contentContainerStyle={{ padding: 16, gap: 12 }}`
- Each course card: icon container (teal icon on primary-100 bg) + title + badge row (category, difficulty) + meta row (pts, time, modules) + chevron
- Empty state shows when no results match filter/search

### Course Detail Screen
- `SafeAreaView bg-white` (bottom edge)
- **Hero:** `bg-primary-500` band, category + difficulty badges (white variant), course title in white, subtitle in `text-primary-200`
- Hero overlaps with content via `-mt-4` on the card below
- **Stats row:** 4-column grid inside white card — CPD pts / estimated time / module count / enrolled count
- **About section:** title + body text
- **Modules list:** numbered rows `bg-slate-50 rounded-2xl` with module index badge, title, section count
- **CTA:** sticky or bottom-anchored "Enrol Now" button (or "Continue Learning" if enrolled)
- Offline download link below CTA button (secondary/ghost style)

### Course Player Screen
- `SafeAreaView bg-white` (bottom)
- **Top bar (not navigation header):** thin `h-1.5` progress bar spanning full width above all content
- Module + section heading row: module name in primary-600 uppercase xs, section title bold, "Section X of Y" meta
- **Content area:** `ScrollView flex-1` — renders TEXT as `text-sm text-slate-700 leading-7`, VIDEO as dark rounded container with play icon, IMAGE as slate container with image icon
- **Footer:** `border-t border-slate-100 px-4 py-4 gap-y-3` — "Mark as Complete" button (only when not done), then prev/next row as two equal secondary buttons
- Completed state: "Mark as Complete" button disappears, "Next →" upgrades to primary

### Certificates Screen
- `SafeAreaView bg-slate-50` top
- **Header block:** white card with title "Certificates" and subtitle
- **Certificate cards:** white card with: `h-1.5 bg-primary-500` decorative top stripe, category badge, course title, issue date, CPD points in teal accent box (top-right), Share + Download PDF buttons separated by divider
- Empty state: ribbon icon + "No certificates yet" + "Complete a course to earn your first one"

### Profile Screen
- `SafeAreaView bg-slate-50` top
- **Header card:** white, shows full name, cadre badge, avatar placeholder (person icon in `bg-primary-100 rounded-3xl`), member since date
- **Subscription card:** `Card variant="teal"` — tier name large, expiry date small, shield icon
- **Profile details card:** white card, "Edit" toggle top-right — view mode shows label/value rows; edit mode shows Input fields inline
- **Logout button:** `Button variant="danger"` at bottom — triggers `Alert.alert` confirmation before calling `clearAuth()`

---

## PART 4 — Data Entities & API Reference

### Key entities
| Entity | Key fields |
|---|---|
| `User` | id, email, fullName, cadre, nczRegistrationNumber, institution, province, specialtyArea, subscriptionTier, subscriptionExpiresAt, avatarUrl |
| `Course` | id, title, subtitle, description, category, difficulty, cpdPoints, estimatedMinutes, status |
| `Module` | id, courseId, title, order |
| `ContentSection` | id, moduleId, title, type (TEXT/VIDEO/IMAGE), content, order |
| `Enrollment` | id, userId, courseId, completedAt |
| `Quiz` | id, courseId, moduleId, title, passMark |
| `Question` | id, quizId, text, type (MULTIPLE_CHOICE), order |
| `QuestionOption` | id, questionId, text, isCorrect |
| `Certificate` | id, userId, courseId, issuedAt, cpdPoints, verifyCode |
| `PointEntry` | id, userId, points, reason, createdAt |

### API endpoints

```
POST   /api/auth/register           → { user, accessToken, refreshToken }
POST   /api/auth/login              → { user, accessToken, refreshToken }
POST   /api/auth/refresh            → { accessToken, refreshToken }
POST   /api/auth/logout
GET    /api/auth/me                 → User (full profile)
PATCH  /api/auth/me                 → User (body: partial profile fields)

GET    /api/courses?status=PUBLISHED&category=&q=  → Course[]
GET    /api/courses/:id             → Course & { modules: Module[] }
GET    /api/courses/:id/modules     → ModuleWithSections[]  ← verify this exists

POST   /api/enrollments             → Enrollment  (body: { courseId })
GET    /api/enrollments             → Enrollment[]
PATCH  /api/enrollments/:id         → Enrollment  (body: { sectionId, totalSections })
GET    /api/enrollments/:id/progress → { completedSectionIds: string[] }

GET    /api/points/my               → { total, target, entries[] }

GET    /api/recommendations         → { courses: Course[], isProfileBased, message? }
POST   /api/recommendations/refresh → 204

GET    /api/certificates/my         → Certificate[]

GET    /api/quizzes/:quizId         → Quiz & { questions: (Question & { options: QuestionOption[] })[] }
POST   /api/quizzes/:quizId/attempt → { passed, score, correctCount, totalCount }
```

---

## PART 5 — Sprint Plan

### How to use this plan

- Complete all tasks in a sprint before starting the next one
- Run `pnpm --filter @zimhealth/mobile type-check` after every sprint — zero errors required
- Read `docs/UI_UX_STANDARDS.md` before writing any UI code
- Check existing components in `src/components/ui/` before creating new ones
- All API calls go through `src/lib/api.ts` — never use raw `fetch` in a screen
- All state goes through `src/store/auth.store.ts` or TanStack Query — never in component-local state for server data

---

### Sprint 0 — Setup ✅ (complete)

The skeleton is built. The following exist and must not be regenerated:
- Config: `App.tsx`, `global.css`, `tailwind.config.js`, `babel.config.js`, `metro.config.js`
- Core: `src/lib/api.ts`, `src/lib/storage.ts`, `src/store/auth.store.ts`
- UI: `src/components/ui/{Button,Input,Card,Badge}.tsx`
- Navigation: `src/navigation/{types,RootNavigator,AuthNavigator,AppNavigator}.tsx`
- Screens (skeletons): all 8 screens in `src/screens/`

**To start the app:**
```bash
cd apps/mobile
pnpm install
npx expo start
```
Add placeholder `assets/icon.png` and `assets/splash.png` (1024×1024 teal PNG) to proceed past the splash.

---

### Sprint 1 — Auth Flow

**Goal:** Register → login → persist session → auto-login on reopen. The screens already exist; this sprint wires them to the API and validates the full auth cycle.

#### Tasks

- [ ] **Token refresh:** In `src/lib/api.ts`, intercept 401 responses. Call `POST /api/auth/refresh` with the stored refresh token. On success, save new tokens and retry the original request once. On failure, call `clearAuth()` and let `RootNavigator` redirect to Login.
- [ ] **Login screen:** Confirm `useMutation` → `POST /api/auth/login` → `setAuth()` works end-to-end. Test with dev credentials.
- [ ] **Register screen:** Confirm `useMutation` → `POST /api/auth/register` → `setAuth()` works end-to-end.
- [ ] **Bootstrap:** Confirm closing and reopening the app lands on Dashboard (not Login) when a token exists.
- [ ] **Validation:** Login button disabled until both fields non-empty. Register "Next" disabled until name ≥ 2 chars, email contains `@`, password ≥ 8 chars.
- [ ] **"Forgot password" screen:** Create `src/screens/auth/ForgotPasswordScreen.tsx`. Simple screen: heading, body text "Contact us via WhatsApp at +263 XX XXX XXXX to reset your password.", back button. Add to `AuthStackParamList` and `AuthNavigator`.
- [ ] **Test checklist:**
  - [ ] Register new account → lands on Dashboard
  - [ ] Close app → reopen → lands on Dashboard (not Login)
  - [ ] Wrong password → red error banner visible
  - [ ] Register duplicate email → "Email already registered" error visible

**Files to modify:** `src/lib/api.ts`, `src/screens/auth/LoginScreen.tsx`, `src/screens/auth/RegisterScreen.tsx`  
**Files to create:** `src/screens/auth/ForgotPasswordScreen.tsx`

---

### Sprint 2 — Dashboard & Course Browsing

**Goal:** Dashboard shows real data. Courses are browsable, searchable, filterable. Enrolling works.

#### Tasks

- [ ] **Dashboard — CPD progress:** `GET /api/points/my` → render linear progress bar. Show `{total} / {target} pts`. If no points endpoint, use 0/60 as defaults and add a `// TODO: verify endpoint` comment.
- [ ] **Dashboard — stats row:** Show completed course count from enrollments, total points from points API, streak as `—` (placeholder until streak is tracked in backend).
- [ ] **Dashboard — continue learning:** Filter `GET /api/enrollments` for the most recent incomplete enrollment. Tap → navigate to `CourseDetail`.
- [ ] **Dashboard — recommendations:** Fetch `GET /api/recommendations`. Wire refresh button to `POST /api/recommendations/refresh` then invalidate query. Show `isProfileBased` label when true.
- [ ] **Courses — search debounce:** Debounce search input 300ms before updating the query key.
- [ ] **Courses — navigation:** Tapping a course card navigates to `CourseDetail` with `courseId`.
- [ ] **CourseDetail — enrol:** `POST /api/enrollments { courseId }` → invalidate `enrollments-mine` query → navigate to `CoursePlayer`.
- [ ] **CourseDetail — already enrolled:** Show "Continue Learning" if enrollment exists, "Completed — Review" if `completedAt` is set.
- [ ] **Skeleton component:** Create `src/components/ui/Skeleton.tsx` — an animated pulsing placeholder view:
  ```tsx
  export function Skeleton({ className }: { className?: string }) {
    return <View className={`bg-slate-200 animate-pulse rounded-3xl ${className}`} />;
  }
  ```
  Use it for loading states on Dashboard and Courses.
- [ ] **Test checklist:**
  - [ ] Dashboard loads with real user name
  - [ ] Progress bar reflects actual points
  - [ ] Search for a course by title — results update
  - [ ] Filter by category — results filter
  - [ ] Enrol in a course — enrollment appears in "Continue Learning"

**Files to modify:** all four learner screens  
**Files to create:** `src/components/ui/Skeleton.tsx`

---

### Sprint 3 — Course Player & Quiz

**Goal:** Nurses can read course content, mark progress, take quizzes, and earn CPD points.

#### Tasks

- [ ] **Verify modules endpoint:** Check if `GET /api/courses/:id/modules` returns sections. If not, add it to `backend/src/routes/courses.ts`:
  ```ts
  router.get('/:id/modules', requireAuth, async (req, res) => {
    const modules = await db.module.findMany({
      where: { courseId: req.params.id },
      orderBy: { order: 'asc' },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    res.json(modules);
  });
  ```
- [ ] **CoursePlayer — TEXT sections:** Render `currentSection.content` as `<Text className="text-sm text-slate-700 leading-7">`. Handle newlines with `{'\n'}` or split on `\n`.
- [ ] **CoursePlayer — VIDEO sections:** Install `expo install expo-av`. Render `<Video source={{ uri: content }} useNativeControls style={{ height: 200, borderRadius: 16 }} />`.
- [ ] **CoursePlayer — mark complete:** `POST /api/enrollments/:id/progress { sectionId }`. On success, invalidate `enrollment-progress` query and advance to next section.
- [ ] **CoursePlayer — progress loading:** Use `GET /api/enrollments/:id/progress` to load `completedSectionIds`. Grey-check completed sections in the sidebar/header.
- [ ] **Quiz screen:** Create `src/screens/learner/QuizScreen.tsx`:
  - Fetch `GET /api/quizzes/:quizId`
  - Show questions one at a time with A/B/C/D letter badges for options
  - Selected answer highlighted in `bg-primary-100 border-primary-500`
  - "Next" button only active when an answer is selected
  - On last question: submit → `POST /api/quizzes/:quizId/attempt { answers: Record<questionId, optionId> }`
  - Result screen: passed (`bg-green-50`, check icon, score, CPD points earned) or failed (`bg-red-50`, retry button)
- [ ] **Add QuizScreen to navigation:**
  ```ts
  // navigation/types.ts
  CoursesStackParamList: {
    // ...existing
    Quiz: { quizId: string; moduleTitle: string };
  }
  ```
  Add `<Stack.Screen name="Quiz" component={QuizScreen} />` to `AppNavigator.tsx`
- [ ] **Navigate to quiz:** After completing the last section of a module, show a "Take Quiz →" button that navigates to `Quiz` screen.
- [ ] **Test checklist:**
  - [ ] Open a course with TEXT sections — content renders correctly
  - [ ] Mark a section complete — progress bar advances
  - [ ] Close app and reopen player — completed sections still marked
  - [ ] Complete a quiz and pass — success screen shows correct score
  - [ ] Fail a quiz — retry button works

**Files to modify:** `CoursePlayerScreen.tsx`, `AppNavigator.tsx`, `navigation/types.ts`, optionally `backend/src/routes/courses.ts`  
**Files to create:** `src/screens/learner/QuizScreen.tsx`

---

### Sprint 4 — Offline Mode

**Goal:** Course content downloadable. Player works on airplane mode. Progress queues and syncs.

#### Tasks

- [ ] **Install NetInfo:** `expo install @react-native-community/netinfo`
- [ ] **Create `src/hooks/useOnlineStatus.ts`:**
  ```ts
  import NetInfo from '@react-native-community/netinfo';
  import { useEffect, useState } from 'react';
  export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true);
    useEffect(() => {
      const unsub = NetInfo.addEventListener((state) => {
        setIsOnline(state.isConnected ?? true);
      });
      return unsub;
    }, []);
    return isOnline;
  }
  ```
- [ ] **Create `src/lib/offlineDB.ts`** using `expo-sqlite`:
  ```ts
  // Tables:
  // offline_modules(id TEXT PRIMARY KEY, courseId TEXT, data TEXT)
  // pending_progress(id TEXT PRIMARY KEY, enrollmentId TEXT, sectionId TEXT, createdAt INTEGER)
  export async function saveModuleOffline(courseId: string, modules: ModuleWithSections[]): Promise<void>
  export async function getOfflineCourse(courseId: string): Promise<ModuleWithSections[] | null>
  export async function queueProgress(enrollmentId: string, sectionId: string): Promise<void>
  export async function syncPendingProgress(apiFn: typeof api): Promise<number>  // returns synced count
  export async function deleteOfflineCourse(courseId: string): Promise<void>
  ```
- [ ] **Create `src/components/ui/OfflineBanner.tsx`:**
  ```tsx
  // Amber banner: "You're offline — progress will sync when you reconnect"
  // Only visible when !isOnline
  // Position: below SafeAreaView top, above main content
  // Height: auto (never fixed)
  ```
- [ ] **Add OfflineBanner to App.tsx** inside `SafeAreaProvider` so it appears on all screens.
- [ ] **CourseDetail — download button:**
  - On press: fetch `GET /api/courses/:id/modules` → call `saveModuleOffline()`
  - Show `ActivityIndicator` while downloading
  - On success: change button to "Downloaded ✓ — Remove" (calls `deleteOfflineCourse`)
  - Track download state in `AsyncStorage` key `offline_courses` (JSON array of courseIds)
- [ ] **CoursePlayer — offline data source:**
  ```ts
  const { data: onlineModules } = useQuery({ enabled: isOnline, ... });
  const [offlineModules, setOfflineModules] = useState(null);
  useEffect(() => {
    if (!isOnline) getOfflineCourse(courseId).then(setOfflineModules);
  }, [isOnline]);
  const modules = isOnline ? onlineModules : offlineModules;
  ```
- [ ] **CoursePlayer — offline progress:**
  When `!isOnline`: call `queueProgress(enrollmentId, sectionId)` instead of API mutation.
  When back online (via `useOnlineStatus`): call `syncPendingProgress(api)`.
- [ ] **Test checklist:**
  - [ ] Download a course on Wi-Fi
  - [ ] Enable airplane mode → open downloaded course → content visible
  - [ ] Mark sections complete offline — no errors
  - [ ] Disable airplane mode → `syncPendingProgress` runs → points updated

**Files to create:** `src/hooks/useOnlineStatus.ts`, `src/lib/offlineDB.ts`, `src/components/ui/OfflineBanner.tsx`  
**Files to modify:** `App.tsx`, `CourseDetailScreen.tsx`, `CoursePlayerScreen.tsx`

---

### Sprint 5 — Certificates & Profile Polish

**Goal:** Certificates shareable and downloadable as PDF. Profile fully editable. Avatar upload.

#### Tasks

- [ ] **CertificatesScreen:** Confirm `GET /api/certificates/my` returns data. Render certificate cards per spec (Section 3).
- [ ] **Share button:** `Share.share({ message: ..., title: ... })` with course name and verify code (already stubbed).
- [ ] **PDF download:** `expo install expo-print expo-sharing`
  - Generate HTML string for the certificate (name, course, date, points, verify code, QR stub)
  - `const { uri } = await Print.printToFileAsync({ html })`
  - `await Sharing.shareAsync(uri)`
- [ ] **Toast library:** Install `react-native-toast-message`. Add `<Toast />` to `App.tsx`. Replace all `Alert.alert` success messages with `Toast.show({ type: 'success', text1: '...' })`.
- [ ] **ProfileScreen — cadre picker:** Add the chip-style cadre selector (same pattern as RegisterScreen) to the edit mode of ProfileScreen. Currently only `Input` fields are shown.
- [ ] **Avatar upload:**
  - `expo install expo-image-picker`
  - Tap avatar area → `ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images', aspect: [1,1] })`
  - On selection: `POST /api/media/image` (multipart/form-data with Bearer token) → `PATCH /api/auth/me { avatarUrl }`
  - Show `<Image source={{ uri: me.avatarUrl }} />` when set, fallback to icon
- [ ] **Test checklist:**
  - [ ] View certificates (need at least one completed course from Sprint 3)
  - [ ] Tap Share → OS share sheet appears with text
  - [ ] Tap Download PDF → file saves and share sheet opens with PDF
  - [ ] Edit profile, change cadre, save → cadre badge on profile header updates
  - [ ] Upload avatar → appears on profile header

**Files to modify:** `CertificatesScreen.tsx`, `ProfileScreen.tsx`, `App.tsx`

---

### Sprint 6 — Push Notifications

**Goal:** Nurses receive renewal reminders. Completing a course sends a congratulations notification.

#### Tasks

- [ ] **Install:** `expo install expo-notifications`
- [ ] **Create `src/lib/notifications.ts`:**
  ```ts
  export async function registerForPushNotifications(): Promise<string | null>
  // Requests permission, gets Expo push token, returns token or null if denied
  ```
- [ ] **Register on login:** Call `registerForPushNotifications()` in `RootNavigator` after `isBootstrapped && user`. POST the token to a backend endpoint (create `PATCH /api/auth/me { pushToken }` if it doesn't exist — add `pushToken` column to User if needed).
- [ ] **Handle notification tap:**
  - Renewal reminder → navigate to `CertificatesTab`
  - New course → navigate to `CoursesTab`
  - Use `Notifications.addNotificationResponseReceivedListener` in App.tsx
- [ ] **Local notification on completion:** When `CoursePlayer` detects the final section is marked complete, schedule a local notification: "🎉 You completed [Course Title]! Your CPD points have been updated."
- [ ] **Test:** Use Expo Push Notification Tool to send a test push to the registered token.

**Files to create:** `src/lib/notifications.ts`  
**Files to modify:** `App.tsx`, `RootNavigator.tsx`, `CoursePlayerScreen.tsx`

---

### Sprint 7 — Onboarding & Deep Links

**Goal:** First-time users see onboarding slides. WhatsApp and web deep links open the app.

#### Tasks

- [ ] **Onboarding screen:** Create `src/screens/OnboardingScreen.tsx`
  - 3 slides (use `FlatList` horizontal with `pagingEnabled`):
    - Slide 1: 🌐 "Learn anywhere" — offline, WhatsApp, or web
    - Slide 2: 📊 "Track your CPD automatically" — no paperwork
    - Slide 3: 🤖 "Your personal AI tutor" — smart recommendations
  - Each slide: large emoji, bold title, descriptive body, dot indicators at bottom
  - "Get Started" button on last slide → navigate to Register
  - "Already have an account?" link → navigate to Login
  - Background: `bg-primary-500` on all slides
  - Text: white throughout
- [ ] **Show once:** Check `storage.getItem('onboarding_done')` in `RootNavigator`. If null AND no user → show Onboarding. On "Get Started" press: `storage.setItem('onboarding_done', '1')` then navigate to Register.
- [ ] **Deep links:** In `app.json`, scheme `zimhealth` is already set. Add `linking` config to `NavigationContainer` in `App.tsx`:
  ```tsx
  const linking = {
    prefixes: ['zimhealth://'],
    config: {
      screens: {
        App: {
          screens: {
            CoursesTab: {
              screens: {
                CourseDetail: 'courses/:courseId',
              },
            },
          },
        },
      },
    },
  };
  ```
  Test: `npx uri-scheme open "zimhealth://courses/SOME_COURSE_ID" --ios`
- [ ] **Test checklist:**
  - [ ] Fresh install → onboarding shows
  - [ ] Close app → reopen → onboarding does NOT show again
  - [ ] Deep link opens correct course detail screen

**Files to create:** `src/screens/OnboardingScreen.tsx`  
**Files to modify:** `RootNavigator.tsx`, `App.tsx`

---

### Sprint 8 — Polish & App Store

**Goal:** App is production-ready. Passes App Store review. Biometric login available.

#### Tasks

- [ ] **Biometric login:**
  - `expo install expo-local-authentication`
  - After bootstrap: if `user` exists, offer Face ID / fingerprint prompt
  - On success: proceed to app. On failure or not enrolled: show normal Login screen
  - Add toggle in ProfileScreen: "Use Face ID / Fingerprint to log in" with a `Switch`
- [ ] **Performance:**
  - Memoize `FlatList` `renderItem` with `useCallback`
  - Add `initialNumToRender={8}` and `maxToRenderPerBatch={5}` to all FlatLists
  - Confirm no `console.log` statements in production builds
- [ ] **Haptics:** `expo install expo-haptics`. Add `Haptics.selectionAsync()` on quiz option select. Add `Haptics.notificationAsync(NotificationFeedbackType.Success)` on course completion.
- [ ] **App icon and splash:**
  - Replace `assets/icon.png` with real 1024×1024 branded icon
  - Replace `assets/splash.png` with real splash screen
  - Ensure `app.json` splash `backgroundColor` matches the image background
- [ ] **Production API URL:** Update `app.json` `extra.apiUrl` to `https://api.zimhealthcpd.co.zw`
- [ ] **Type-check:** `pnpm --filter @zimhealth/mobile type-check` — must exit 0
- [ ] **EAS Build:**
  - `npm install -g eas-cli`
  - `eas build:configure`
  - `eas build --platform ios --profile preview`
  - `eas build --platform android --profile preview`
- [ ] **Submit to TestFlight:** `eas submit --platform ios`
- [ ] **Final QA checklist:**
  - [ ] Register → complete profile → earn CPD points end-to-end
  - [ ] Download course offline → complete → sync on reconnect
  - [ ] Complete a quiz → certificate appears
  - [ ] Download and share certificate PDF
  - [ ] Edit specialty area → recommendations change
  - [ ] Deep link from browser to course detail
  - [ ] Receive push notification → tapping opens correct screen
  - [ ] Biometric login works on device with Face ID / fingerprint configured

---

## PART 6 — Agent Rules

### Must do

1. **Read UI/UX Laws** (Part 1) before writing any component code.
2. **Check existing components** in `src/components/ui/` before creating new ones.
3. **Run type-check** after every sprint. Fix all errors before marking sprint complete.
4. **Handle all three data states** — loading skeleton, error with retry, success with data.
5. **Use `api.ts`** for all HTTP calls — never raw `fetch` in a screen file.
6. **Test on a real device or simulator** before declaring a sprint done — the TypeScript compiler does not catch visual regressions.

### Must not do

1. **Do not regenerate existing skeleton files.** All 8 screens and 4 UI components from Sprint 0 exist. Modify them, do not replace them.
2. **Do not add colours outside the palette.** If the design calls for a colour that is not in `tailwind.config.js`, use the nearest existing token.
3. **Do not use `StyleSheet.create()`** unless NativeWind cannot express the style (e.g. dynamic values like `width: someVariable`). All static styles use `className`.
4. **Do not add animation libraries** before Sprint 8. React Navigation defaults and `animate-pulse` are sufficient.
5. **Do not split a sprint** by creating files and leaving them empty or with `// TODO` bodies. Every sprint must be fully functional before the next begins.
6. **Do not touch the backend** unless a specific sprint task calls for it. When a backend change is needed, the task will say "create this endpoint in `backend/src/routes/...ts`" explicitly.
7. **Do not assume an API endpoint exists.** Always verify with `grep -r "router\.(get|post|patch|delete)" backend/src/routes/` before calling it.
8. **Do not invent new navigation patterns.** Use the existing stack/tab structure. Add screens to the appropriate existing navigator.
