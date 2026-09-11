# Sprint 06 — Multi-channel reminders

**Track:** Backend. **Priority:** P1. **Depends on:** nothing.

## Goal
Extend `backend/src/jobs/notificationWorker.ts` so renewal reminders go out over email and SMS in addition to the existing WhatsApp-only path.

## Why
Industry-standard CPD platforms use multi-channel reminders because not every learner has WhatsApp reachable at all times. Gap analysis §4 ("Notifications" row).

## Scope
- `notificationWorker.ts` currently has `sendWhatsAppMessage()` with a clean env-driven dry-run pattern (no Twilio creds → log only). Replicate that exact pattern for:
  - **Email**: check if an email provider is already wired anywhere in the repo (grep for `nodemailer`, `sendgrid`, `resend`, `ses` across `backend/src`). If one exists, reuse it; if not, add a minimal `sendEmail()` using whatever the project already depends on for transactional email (check `package.json` first — do not add a new dependency without checking for an existing one).
  - **SMS**: Twilio SMS (not WhatsApp) using the same `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` already present, plus a new `TWILIO_SMS_FROM` env var. Same dry-run-if-missing-creds pattern.
- Update the `renewal-reminder` job processor to attempt all three channels per learner where the learner has the relevant contact info (`User.email`, `User.phone`), not just WhatsApp.
- Respect the existing `reminderDays = [90, 60, 30, 7]` cadence — don't change the schedule, just the delivery channels.
- Add per-channel entries to `AuditLog` (or extend the existing log call) so it's auditable which channel actually delivered.

## Non-goals
- Do not build push notifications (mobile) in this sprint — that requires app store push credentials and is a separate effort.
- Do not change reminder copy/AI-drafting logic — only the delivery layer.

## Acceptance criteria
- [ ] With no email/SMS credentials configured, the job still runs and dry-run-logs both channels without throwing.
- [ ] With credentials configured (test against a sandbox/dev account), a learner with both email and phone receives both a WhatsApp message and an email/SMS for the same reminder cycle.
- [ ] No duplicate sends if a job is retried (idempotency — check how the existing WhatsApp path avoids double-send, if at all, and match it).

## Verification
- Run the `renewal-reminder` Bull job manually in dev (trigger via a script or temporarily adjust `reminderDays` to include today's day-count) and inspect logs for all three channels in dry-run mode.
- `cd backend && pnpm test` if notification worker tests exist; add one covering the dry-run path for each new channel.
