# Sprint S16 — Bot CPD cycle completion celebration message

### Priority: HIGH
### Feature: Feature 5 (Effortless credit tracking)

---

## The Problem

When a learner earns enough CPD points to meet their annual renewal requirement, nothing
happens. The system records the points silently. The learner has no idea they are done
unless they open the web portal and check.

The "effortless credit tracking" promise says the system handles everything automatically.
The nurse should receive a WhatsApp confirmation the moment they cross the finish line —
not just a silent database write.

This applies to two credit paths:
1. **WhatsApp quiz completion** — via `POST /api/points/bot/credit` in `backend/src/routes/points.ts`.
2. **Course completion via bot** — the same `bot/credit` endpoint is called after a module quiz pass.

Both paths go through the same endpoint, so one change covers both.

---

## What needs to be built

After `creditPoints()` succeeds in `POST /api/points/bot/credit`, check if the learner's
new total meets or exceeds their required points. If yes, send a congratulatory WhatsApp
message summarising their achievement.

The send must be **fire-and-forget** — it must never cause the credit endpoint to fail.

---

## Exact files to change

1. `backend/src/routes/points.ts` — add completion check after `creditPoints()` call.
2. `backend/src/jobs/notificationWorker.ts` — extract the Twilio send helper into a
   shared utility so `points.ts` can use it too.

Actually, to avoid creating a circular import, keep it simple: copy the same Twilio send
helper pattern directly into `points.ts`. It is small (8 lines) and self-contained.

---

## Step-by-step implementation

### Step 1 — Add a Twilio send helper in `points.ts`

At the top of `backend/src/routes/points.ts`, after the existing imports, add:

```ts
import twilio from 'twilio';

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_NUMBER;
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  if (!sid || !token || !from) {
    console.log(`[points] Completion message (dry run): to=${toFormatted}\n${body}`);
    return;
  }
  const client = twilio(sid, token);
  await client.messages.create({ from, to: toFormatted, body });
}
```

### Step 2 — Add the completion check after `creditPoints()` in `POST /api/points/bot/credit`

Find the section in `POST /api/points/bot/credit` that calls `creditPoints()` and returns
the result. It currently looks like this:

```ts
const result = await creditPoints({
  learnerId: learner.id,
  courseId,
  quizId,
  activityType: 'WHATSAPP_QUIZ' as any,
  quizScore,
});

// Persist attemptKey on the record for audit/deduplication visibility.
if (result.recordId) {
  await db.cPDRecord.update({ ... });
}
// Store attemptKey for audit/dedupe visibility
await db.auditLog.create({ ... });
res.json(result);
```

After the `auditLog.create()` call and **before** `res.json(result)`, add:

```ts
// Check if this credit pushed the learner over the finish line.
// Fire-and-forget: never let a failed send block the credit response.
if (result.pointsEarned > 0 && learner.phone) {
  void (async () => {
    try {
      const summary = await getLearnerCPDSummary(learner.id);
      if (summary.totalPoints >= summary.requiredPoints && summary.totalPoints - result.pointsEarned < summary.requiredPoints) {
        // They just crossed the threshold on THIS credit — send celebration.
        const firstName = learner.fullName.split(' ')[0];
        const webUrl = process.env.WEB_URL ?? 'https://zimhealthcpd.co.zw';
        const message =
          `🎉 *Congratulations, ${firstName}!*\n\n` +
          `You've earned *${summary.totalPoints} CPD points* — meeting your ${summary.cycleYear} renewal requirement of ${summary.requiredPoints} points! ✅\n\n` +
          `Your points have been recorded and will be sent to your professional council.\n\n` +
          `Visit ${webUrl}/certificates to download your CPD certificate.\n\n` +
          `_Well done on investing in your professional development._`;
        await sendWhatsAppMessage(learner.phone, message);
      }
    } catch (err) {
      console.error('[points/bot/credit] Completion notification failed', err);
    }
  })();
}
```

### Step 3 — Ensure `learner` has `fullName` and `phone` selected

The current `db.user.findUnique` in that route only selects `{ phone }`. Update the select
to include `fullName`:

Find:
```ts
const learner = await db.user.findUnique({ where: { phone } });
```

Replace with:
```ts
const learner = await db.user.findUnique({
  where: { phone },
  select: { id: true, fullName: true, phone: true },
});
```

Note: `getLearnerCPDSummary` only needs `learnerId`, so no other change is needed there.

---

## The completion condition explained

```ts
summary.totalPoints >= summary.requiredPoints          // new total meets requirement
&& summary.totalPoints - result.pointsEarned < summary.requiredPoints  // was below before this credit
```

This fires the message **exactly once** — only when this specific credit pushed them over
the line. If they were already at 100% before, the second condition is false and no message
is sent. This prevents duplicate celebrations.

---

## Acceptance criteria

- When a WhatsApp user earns the point that takes them from below-required to at-or-above
  required for the cycle, they receive a congratulatory WhatsApp message within a few seconds.
- The message contains: their first name, total points earned, the required points target,
  the cycle year, and a link to the certificates page.
- If the learner was already at or above required before this quiz (e.g. they took an extra
  quiz for practice), no message is sent.
- A Twilio API failure (e.g. invalid phone format) does NOT cause `POST /api/points/bot/credit`
  to return an error — the credit always succeeds, the notification is best-effort.
- When Twilio credentials are not configured (local dev), the message is logged to console
  at INFO level, not swallowed silently.

---

## Do NOT change

- Do not change the `creditPoints()` function in `cpd-engine.ts`.
- Do not change the FREE-tier cap logic (`canEarnWhatsAppPoints`).
- Do not change the audit log write.
- Do not change any bot handler files or frontend files.
