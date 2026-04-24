# Sprint Index: S14-S20 — Feature Completion to 100%

Generated: 2026-04-23  
Goal: Close all gaps identified in the Feature 1-6 audit before claiming production completeness.

---

## How to use this index

Work through sprints in order. Each sprint is self-contained and can be handed directly
to an AI agent. S19 (mobile) should run after S14-S18 because it depends on bot,
offline-sync, and entitlement fixes. S20 is the final production-readiness hardening pass.

After each sprint, verify the acceptance criteria before moving on.

---

## Sprint order and dependencies

| Sprint | File | Priority | Depends on |
|--------|------|----------|------------|
| S14 | `S14_whatsapp_renewal_reminders_actual_send.md` | CRITICAL | None |
| S15 | `S15_bot_enrollment_flow.md` | HIGH | None |
| S16 | `S16_bot_cpd_completion_receipt.md` | HIGH | S15 (needs enrollment to exist) |
| S17 | `S17_free_tier_locked_flag_fix.md` | MEDIUM | None |
| S18 | `S18_bulk_offline_sync_endpoint.md` | MEDIUM | None |
| S19 | `S19_mobile_app_full_implementation.md` | CRITICAL | S14-S18 all done |
| S20 | `S20_council_sync_production_readiness.md` | CRITICAL | S16, S18 |

---

## One-line summary of each sprint

- **S14** — Replace the `logger.info` dry-run in `notificationWorker.ts` with a real Twilio WhatsApp send.
- **S15** — Add `GET /api/bot/courses/available` + `POST /api/bot/enroll` endpoints and a bot BROWSE flow so WhatsApp-only users can enroll in courses without touching the web.
- **S16** — When bot quiz points push a learner's total to ≥ required, send a congratulatory WhatsApp message with their CPD summary.
- **S17** — Remove false `locked` flags for FREE-tier course access, fix premium labels, align pricing, and verify the free annual point cap against council requirements.
- **S18** — Add `POST /api/enrollments/sync-offline` bulk endpoint and update web/mobile reconnect sync to call it instead of N individual PATCH calls.
- **S19** — Full mobile app: correct enrollment route, real course player (PDF/video), quiz component, offline download + sync, CPD dashboard, certificates, subscription/voucher screen, and offline media/quiz handling.
- **S20** — Make council sync production-ready: generic council terminology, live/dry-run mode clarity, retry/ack handling, adapter contract tests, and dashboard verification.

---

## Extra audit gaps now covered by these sprints

The first version of this sprint set covered the obvious implementation gaps, but the
final Feature 1-6 audit found several deeper product-quality gaps. They are now assigned here:

| Audit gap | Covered by |
|-----------|------------|
| WhatsApp-only learner cannot browse/enroll without web | S15 |
| Bot renewal reminders are generated but not sent | S14 |
| Bot completion receipt is missing when required points are reached | S16 |
| FREE learners see courses incorrectly marked as locked | S17 |
| Pricing is inconsistent across admin/payment/web/mobile | S17 |
| Free annual point cap may not match council renewal requirements | S17 |
| Web offline sync still sends one request per completed section | S18 |
| Mobile enrollment calls the wrong backend endpoint | S19 |
| Mobile has no real quiz/offline quiz flow | S19 |
| Mobile offline downloads metadata only, not media/document assets | S19 |
| Full current-cycle offline pack is not automatically prepared on Wi-Fi | S19 |
| AI tutor is not guaranteed to use Claude/Anthropic in production config | S20 |
| Adaptive learning recommends courses but not module-level next steps | S20 |
| Council sync adapter is not proven against a live/contract-tested council integration | S20 |

---

## Files touched across all sprints

### Backend
| File | Changed in |
|------|-----------|
| `backend/src/jobs/notificationWorker.ts` | S14 |
| `backend/src/routes/bot.ts` | S15 |
| `backend/src/routes/enrollments.ts` | S18 |
| Current council sync router/service/job files | S20 |

### Frontend (web)
| File | Changed in |
|------|-----------|
| `apps/web/src/hooks/useOnlineStatus.ts` | S18 |
| `apps/web/src/pages/learner/Dashboard.tsx` | S17 |
| `apps/web/src/pages/learner/Courses.tsx` | S17 |
| `apps/web/src/pages/admin/AdminDashboard.tsx` | S20 |
| Current council dashboard page | S20 |

### WhatsApp bot
| File | Changed in |
|------|-----------|
| `apps/whatsapp-bot/src/botRouter.ts` | S15 |
| `apps/whatsapp-bot/src/handlers/learnHandler.ts` | S15 |
| `apps/whatsapp-bot/src/handlers/quizHandler.ts` | S16 |
| `apps/whatsapp-bot/src/sessionManager.ts` | S15 |

### Mobile (S19 only)
| File | Changed/created in |
|------|-----------|
| `apps/mobile/src/screens/learner/CoursePlayerScreen.tsx` | S19 |
| `apps/mobile/src/screens/learner/DashboardScreen.tsx` | S19 |
| `apps/mobile/src/screens/learner/CertificatesScreen.tsx` | S19 |
| `apps/mobile/src/screens/learner/CourseDetailScreen.tsx` | S19 |
| `apps/mobile/src/lib/offlineDB.ts` | S19 (new file) |
| `apps/mobile/src/hooks/useOnlineStatus.ts` | S19 (new file) |
| `apps/mobile/src/screens/learner/SubscriptionScreen.tsx` | S19 (new file) |

---

## Verification checklist (run after all sprints)

### Feature 1 — Three access channels
- [ ] WhatsApp renewal reminder is sent as a real Twilio message, visible in Twilio logs.
- [ ] A WhatsApp-only user can type "browse" in the bot and enroll in a course without using the web.

### Feature 2 — Offline mode
- [ ] Completing 5 sections offline queues 1 bulk sync request (not 5 individual requests) when reconnected.
- [ ] Mobile offline download includes course JSON, quiz data, and locally usable media/document assets where supported.
- [ ] The mobile app can queue quiz attempts offline and sync them after reconnect.
- [ ] A current-cycle offline pack can be prepared while on Wi-Fi without manually opening every course.

### Feature 3 — AI Tutor
- [ ] Production config explicitly uses Anthropic/Claude for the AI tutor, or the UI/admin health check clearly reports a configured fallback provider.
- [ ] The WhatsApp AI tutor remains premium-gated where intended and returns safe clinical guidance with escalation language for red flags.

### Feature 4 — Smart recommendations
- [ ] FREE-tier learner sees courses on Dashboard and Courses page without any false "locked" indicator.
- [ ] Recommendations include module-level "next best module" suggestions or the product copy says "course recommendations" instead of "adaptive module sequencing".
- [ ] AI recommendation failure has a deterministic fallback based on cadre, weak quiz categories, council, and recent activity.

### Feature 5 — Council credit tracking
- [ ] When a WhatsApp nurse reaches their required points, they receive a completion message on WhatsApp within seconds.
- [ ] Council sync uses generic `/api/council` terminology in UI/API-facing sprint instructions.
- [ ] Council sync has a tested dry-run mode, live mode, retry behavior, and acknowledgement/reconciliation story.

### Feature 6 — Free-to-start model
- [ ] FREE learner can browse and enroll in council-approved courses on web with no paywall barrier.
- [ ] FREE learner sees what IS paywalled (AI tutor, formal certificate) clearly labelled, not the courses.
- [ ] Standard/Diaspora pricing is consistent across backend payment config, admin config, web UI, mobile UI, and WhatsApp copy.
- [ ] The free annual WhatsApp point cap is either derived from council requirements or labelled honestly when it is a fixed promotional cap.
