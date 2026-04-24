# Sprint S14 — WhatsApp renewal reminders must actually send

### Priority: CRITICAL
### Feature: Feature 1 (Three access channels) + Feature 5 (Effortless credit tracking)

---

## The Problem

`backend/src/jobs/notificationWorker.ts` already does all the right things:
- Runs daily at 8am via Bull cron.
- Checks how many days remain until cycle end.
- Fires on days 90, 60, 30, 7 before the deadline.
- Queries all active learners who have not yet completed their CPD.
- Uses AI to write a personalised, motivating WhatsApp message for each learner.

But it never sends anything. Line 77 reads:

```ts
logger.info('Reminder (dry run)', { to: learner.phone, message });
```

The message is built and then thrown away. No WhatsApp message is ever dispatched.

The backend already has the `twilio` npm package installed (it is in `backend/package.json`).
The WhatsApp send logic from the bot lives in `apps/whatsapp-bot/src/twilio.ts` and
`apps/whatsapp-bot/src/whatsapp/transport.ts`. The backend cannot import from the bot app
directly, so it must call Twilio's REST API itself — which is straightforward.

---

## Exact file to change

`backend/src/jobs/notificationWorker.ts`

No other files need to change.

---

## Step-by-step implementation

### Step 1 — Add a private send helper inside notificationWorker.ts

At the top of the file, after the existing imports, add this helper function.
It mirrors the pattern already used in `apps/whatsapp-bot/src/twilio.ts`.

```ts
import twilio from 'twilio';

/**
 * Send a WhatsApp message via Twilio.
 * Falls back to logging when credentials are not configured (local dev).
 */
async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const from   = process.env.TWILIO_WHATSAPP_NUMBER;

  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  if (!sid || !token || !from) {
    // Dev/staging fallback — credentials not configured. Print instead of sending.
    logger.info('[notificationWorker] Reminder (dry run — no Twilio credentials)', {
      to: toFormatted,
      body,
    });
    return;
  }

  const client = twilio(sid, token);
  await client.messages.create({ from, to: toFormatted, body });
}
```

### Step 2 — Replace the dry-run logger.info with an actual send

Find line 77 in `notificationWorker.ts`:

```ts
logger.info('Reminder (dry run)', { to: learner.phone, message });
sent += 1;
```

Replace it with:

```ts
await sendWhatsAppMessage(learner.phone!, message);
sent += 1;
```

### Step 3 — Add error logging on send failure

The existing `catch` block only logs a warning. Verify it looks like this (it should already):

```ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn('Failed to send reminder', { learnerId: learner.id, error: message });
}
```

This is already correct — a single failed send must not abort the rest of the batch.

### Step 4 — Update the return value to report actual sends vs skips

At the end of the processor, change the return from `{ sent, daysLeft }` to:

```ts
return { sent, skipped: learners.length - sent, daysLeft };
```

This makes it easier to spot delivery issues in Bull dashboard logs.

---

## What the final processor function should look like (key section only)

```ts
notificationQueue.process('renewal-reminder', async () => {
  const today = new Date();
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const daysLeft = Math.ceil((yearEnd.getTime() - today.getTime()) / 86400000);
  const reminderDays = [90, 60, 30, 7];

  if (!reminderDays.includes(daysLeft)) {
    return { skipped: true, daysLeft };
  }

  const learners = await db.user.findMany({
    where: { role: 'LEARNER', isActive: true, phone: { not: null } },
    select: { id: true, fullName: true, phone: true, cadre: true },
  });

  let sent = 0;
  const ai = new AIClient(buildAiConfig());

  for (const learner of learners.slice(0, 100)) {
    try {
      const summary = await getLearnerCPDSummary(learner.id);
      if (summary.percentComplete >= 100) continue;  // already done — skip

      const pointsNeeded = Math.max(0, summary.requiredPoints - summary.totalPoints);
      const prompt = `Write a WhatsApp reminder message for this health professional:
Name: ${learner.fullName.split(' ')[0]}
Days until CPD renewal deadline: ${daysLeft}
CPD points still needed: ${pointsNeeded}
Under 80 words. Warm and motivating. End with "Reply 1 to start learning."`;

      const message = await ai.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.REMINDER_WRITER,
        maxTokens: 150,
        temperature: 0.7,
      });

      await sendWhatsAppMessage(learner.phone!, message);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to send reminder', { learnerId: learner.id, error: message });
    }
  }

  return { sent, skipped: learners.length - sent, daysLeft };
});
```

---

## Acceptance criteria

- When `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_NUMBER` are set,
  the Bull job sends a real WhatsApp message to each eligible learner's phone.
- When credentials are NOT set (local dev), the job logs the message body at INFO level
  and still returns `{ sent: N }` — it must not throw.
- Learners who are already at 100% are silently skipped (no message sent).
- A single learner send failure does NOT abort the batch — other learners still receive their messages.
- Running the job manually via Bull admin (or `syncQueue.add('renewal-reminder', {})`) should
  produce Twilio API calls visible in the Twilio console.

---

## Do NOT change

- Do not change the AI prompt or message style.
- Do not change `scheduleRenewalReminders` — the cron schedule is correct.
- Do not change any other file.
- Do not import anything from `apps/whatsapp-bot/` — the backend is a separate app.
