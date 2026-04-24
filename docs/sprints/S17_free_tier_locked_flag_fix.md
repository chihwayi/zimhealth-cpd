# Sprint S17 — Fix false "locked" indicator on courses for FREE-tier learners

### Priority: MEDIUM
### Feature: Feature 6 (Free-to-start model)

---

## The Problem

In `backend/src/routes/recommendations.ts`, every course returned for a FREE-tier learner
includes `locked: true`:

```ts
locked: !ent.premiumWebAccess,
```

`premiumWebAccess` is `false` for FREE users (`tierAllowsPremiumWeb` returns false for FREE).
This means FREE learners see ALL recommended courses marked as "locked" in the UI.

But FREE learners **can** actually enrol in and complete council-approved web courses.
There is no gate in `POST /api/courses/:id/enroll` that blocks FREE users. The `locked`
flag is factually wrong — it says "you can't access this" when you actually can.

What IS locked for FREE users (legitimately):
- The AI Tutor (chat assistant)
- Generating a formal PDF CPD certificate

What is NOT locked for FREE users:
- Browsing and enrolling in any council-approved course
- Watching videos and reading content
- Earning CPD points from course completion
- WhatsApp quiz points (up to 12 per cycle)

The fix has four parts:
1. Remove the false `locked` flag from course recommendations.
2. Add accurate "premium feature" labels to the AI Tutor and Certificate sections in the web UI.
3. Align subscription pricing across backend, admin config, web UI, mobile UI, and WhatsApp copy.
4. Verify that the FREE annual WhatsApp points cap is either derived from council requirements
   or clearly presented as a fixed free-tier cap.

---

## Exact files to change

1. `backend/src/routes/recommendations.ts` — remove `locked: !ent.premiumWebAccess` from course payload.
2. `apps/web/src/pages/learner/Dashboard.tsx` — add a "Premium" badge on the AI Tutor card if one exists.
3. `apps/web/src/pages/learner/Certificates.tsx` — add a clear "Upgrade to generate" state for FREE users.
4. Subscription/payment config and UI files that display Standard/Diaspora prices.
5. Entitlement/free-tier cap config files.

---

## Step-by-step implementation

### Step 1 — Fix `recommendations.ts`

Open `backend/src/routes/recommendations.ts`.

Find the `.map()` that builds the response for each course. It currently includes:

```ts
locked: !ent.premiumWebAccess,
```

Remove that line entirely. FREE users should never see web courses as locked.

Also remove the `premiumWebAccess` top-level field from the response (it is no longer
meaningful for courses):

```ts
// REMOVE this line from the response object:
premiumWebAccess: ent.premiumWebAccess,
```

The final response object should be:

```ts
return res.json({
  courses: ordered,
  isProfileBased: recs.isProfileBased,
  // premiumWebAccess removed — courses are not gated by tier
});
```

### Step 2 — Fix `Certificates.tsx` for FREE-tier users

Open `apps/web/src/pages/learner/Certificates.tsx`.

The page currently shows a "Generate Certificate" button for all users. FREE users get
an error from the backend (`canGenerateCertificate` returns false for FREE).

Add a check using the auth store to detect FREE tier and show a friendly upgrade prompt
instead of letting them click and get an error.

After the existing imports, add:
```ts
import { useAuthStore } from '../../store/auth.store';
```

At the top of the component, add:
```ts
const user = useAuthStore((s) => s.user);
const isFree = !user?.subscriptionTier || user.subscriptionTier === 'FREE';
```

Then find the "Generate Certificate" button (or wherever `generateMutation.mutate()` is
called). Wrap it with a conditional:

```tsx
{isFree ? (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
    <p className="text-sm font-semibold text-amber-900">Certificate generation is a premium feature</p>
    <p className="text-xs text-amber-700 mt-1 mb-3">
      Upgrade to Standard to download your official CPD certificate.
    </p>
    <a
      href="/subscription"
      className="inline-block px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
    >
      View upgrade options
    </a>
  </div>
) : (
  /* existing generate certificate button unchanged */
)}
```

### Step 3 — Update `Dashboard.tsx` AI Tutor card (if present)

Open `apps/web/src/pages/learner/Dashboard.tsx`. Search for any AI Tutor link or card.
If there is a card or button that links to the AI tutor feature, add a small "Premium"
badge next to it for FREE users:

```tsx
{isFree && (
  <span className="ml-2 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
    Premium
  </span>
)}
```

Add the same `isFree` check as in Step 2 (import `useAuthStore`, derive `isFree`).

If there is no AI Tutor card on the Dashboard, skip this step — do not add one just for
this sprint.

### Step 4 — Align subscription pricing everywhere

Search the repo for Standard/Diaspora pricing and make sure one source of truth drives
all public and admin displays.

Known places to inspect:

- backend payment price map
- backend/admin tier config
- web subscription page
- mobile subscription screen
- WhatsApp payment/upgrade copy
- `.env.example` or seed/demo config if prices are documented there

Acceptance:

- Standard price is the same in backend payment logic, admin UI, web learner UI, mobile UI,
  and WhatsApp copy.
- Diaspora price is the same in all the same places.
- A test or typed config prevents the admin tier price from drifting from the payment price.

### Step 5 — Verify the FREE annual point cap

The free tier currently promises WhatsApp learning with a limited annual number of CPD
points. That cap must be honest against council renewal rules.

Choose one implementation:

1. Derive the free annual WhatsApp cap from the learner's council requirement when the
   product promise is "enough to renew".
2. Keep a fixed promotional cap, but update all product copy to say exactly how many
   free WhatsApp CPD points are included and avoid claiming it is always enough to renew.

Acceptance:

- If a council requires more points than the free cap, UI/copy does not imply FREE is enough.
- The cap resets by cycle year and cannot be bypassed by repeated bot attempts.
- Paid tiers remain uncapped where intended.

---

## What the correct mental model should be after this sprint

| Feature | FREE | STANDARD+ |
|---------|------|-----------|
| Browse & enrol in council-approved courses | ✅ Yes | ✅ Yes |
| Watch videos, read PDFs, take quizzes on web | ✅ Yes | ✅ Yes |
| Earn CPD points from web course completion | ✅ Yes | ✅ Yes |
| WhatsApp quiz CPD points (up to 12/cycle) | ✅ Yes (capped) | ✅ Yes (uncapped) |
| AI Clinical Tutor on WhatsApp | ❌ Upgrade | ✅ Yes |
| Download formal PDF certificate | ❌ Upgrade | ✅ Yes |

---

## Acceptance criteria

- A FREE-tier learner visits the Courses page or Dashboard — no course shows a "locked"
  or padlock indicator. Courses are accessible.
- A FREE-tier learner visits the Certificates page — sees a clear "Certificate generation
  is a premium feature — upgrade to Standard" message instead of a broken generate button.
- A STANDARD-tier learner is unaffected — their certificate generation works as before.
- The `GET /api/recommendations` response no longer contains a `locked` field on any course.
- Standard/Diaspora pricing is consistent across payment backend, admin config, web UI,
  mobile UI, and WhatsApp copy.
- The FREE annual WhatsApp points cap is council-aware or clearly labelled as a fixed cap.
- TypeScript compilation passes with no errors after the change.

---

## Do NOT change

- Do not change the entitlement service logic — tier rules are correct.
- Do not add any backend paywall gate to course enrollment — FREE users can enroll freely.
- Do not change the AI tutor backend gate — it correctly blocks FREE users.
- Do not change any bot files or the mobile app.
