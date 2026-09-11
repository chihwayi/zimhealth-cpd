# Sprint 00 — Deployment reconciliation (Coolify)

**Status: DONE (2026-09-11).** Auto-deploy webhooks wired and verified live (real push → real rebuild → confirmed serving traffic), `zimhealth-bot` deployed to Coolify (dry-run safe, healthy at `/health`), `deploy-server.sh` marked deprecated in-repo, `coolify-infra/README.md` updated with accurate state. One follow-up not done: confirm whether the Postgres backing `DATABASE_URL` is a Coolify-managed `/databases/postgresql` resource — not yet checked, low priority.

**Track:** Infra. **Priority:** P0 — do first. **Depends on:** nothing.

**Correction (2026-09-11):** an earlier draft of this sprint assumed the Coolify project was an empty placeholder and the app was still served from an old PM2+rsync box. That was wrong — verified directly against the live Coolify API and the live URL:
- `zimhealth-api` (uuid `eq0el77oug2eemd2ow8w5k6l`, `https://eq0el77oug2eemd2ow8w5k6l.31.220.84.245.sslip.io`) and `zimhealth-web` (uuid `t8uipd7pv9dvycoos1l2bgi2`, `https://t8uipd7pv9dvycoos1l2bgi2.31.220.84.245.sslip.io`) are **real, running** Coolify applications, `dockerfile` build pack, deploying from `chihwayi/zimhealth-cpd.git` (`/backend/Dockerfile`, `/apps/web/Dockerfile`), both under project `ns8k83fubnym4gtlmq8mj7tq`.
- `zimhealth-redis` (uuid `dtk0t8a0nbanfdr3pi369dk1`) is a real Coolify-managed Redis, correctly wired into the backend's `REDIS_URL`. `DATABASE_URL` is also set and working.
- Login against the live API works end-to-end: `POST /api/auth/login` with the seeded demo admin (`admin@zimhealthcpd.co.zw` / `Demo@1234`) returns a valid JWT, and `GET /api/admin/stats` (authenticated) returns real DB-backed numbers — confirmed live and matching the codebase audit exactly (`publishedCourses: 1`, matching the "only one seeded course" finding from the gap analysis).

So this sprint is **not** "stand up Coolify from scratch." It's three narrower, verified-open items:

## Goal
Close the three confirmed gaps between "deployed" and "fully production-ready":
1. Auto-deploy on push to `main` is not wired (no GitHub webhook exists on the repo — confirmed via `gh api repos/chihwayi/zimhealth-cpd/hooks` returning `[]`), so every future sprint currently requires a manual Coolify redeploy click.
2. The WhatsApp bot (`apps/whatsapp-bot`) has no Coolify application at all — only `zimhealth-api` and `zimhealth-web` exist. It's not deployed anywhere live.
3. `deploy-server.sh` + `scripts/server-auth.sh` still reference a different, older server (`173.212.195.88`, PM2+rsync) — confirm this is genuinely dead and not a second live copy someone might accidentally deploy to, then deprecate it.

**Explicitly not using GitHub Actions for any of this** (per user instruction — no CI spend). Auto-deploy here means Coolify's own webhook listener firing on a GitHub webhook push event, which is free — not an Actions workflow.

## Why
See `docs/PROPOSAL-VS-REALITY-GAP-ANALYSIS.md` and the standing rule in `docs/sprints/README.md`: every later sprint's definition of done includes being visible on the live server. Right now that requires a human to remember to click "Redeploy" in the Coolify UI after every merge — fine for now, but worth automating since a dozen sprints are about to land.

## Scope
1. **Auto-deploy webhook** (gotcha #4 in `/Users/devoop/Dev/coolify-infra/README.md`): `zimhealth-api` already has `manual_webhook_secret_github` set (confirmed via API), meaning Coolify has a secret ready for this — but no GitHub-side webhook exists yet. Register one via `gh api repos/chihwayi/zimhealth-cpd/hooks -f config[url]=http://31.220.84.245:8000/webhooks/source/github/events/manual -f config[content_type]=json -f config[secret]=<manual_webhook_secret_github value> -f events[]=push --method POST` (fetch the actual secret value from `GET /api/v1/applications/eq0el77oug2eemd2ow8w5k6l` first). Do the same for `zimhealth-web`. Confirm `is_auto_deploy_enabled: true` is also set on both via `PATCH /applications/{uuid}` — it currently reads `None`/unset.
2. **Deploy the WhatsApp bot to Coolify**: check if `apps/whatsapp-bot` has its own Dockerfile (it doesn't, per repo listing — only `backend/Dockerfile` and `apps/web/Dockerfile` exist). Add `apps/whatsapp-bot/Dockerfile` (same shape/base image as `backend/Dockerfile`, since it's also a Node/Express process, different entrypoint — check `apps/whatsapp-bot/package.json` for its start script). Create the Coolify app via `/applications/private-deploy-key` or `/applications/public` (check repo visibility first: `gh repo view chihwayi/zimhealth-cpd --json isPrivate`) with `dockerfile_location: /apps/whatsapp-bot/Dockerfile`, under project `ns8k83fubnym4gtlmq8mj7tq`. Wire its env vars (`WHATSAPP_PROVIDER`, backend URL, `BOT_SECRET` matching whatever `requireBotSecret` middleware expects in `backend/src/routes/bot.ts` / `points.ts`) — leave the actual `META_WA_TOKEN`/`META_WA_PHONE_NUMBER_ID` blank/unset until a paid number is provisioned, confirming the dry-run-safe behavior noted in the gap analysis holds true live, not just in dev.
3. **Retire the old path**: SSH to `173.212.195.88` (read-only check, do not stop/delete anything without confirming with the user first) to see if anything is actually still running there. If it's dead or superseded, add a comment header to `deploy-server.sh` marking it deprecated in favor of Coolify, pointing at this file.
4. Update `/Users/devoop/Dev/coolify-infra/README.md`'s zimhealth-cpd entry (currently stale/wrong) with the real, verified state: uuids, URLs, the fact it's a working Dockerfile-pack deployment, and the new bot app once added.

## Non-goals
- Do not touch other projects/apps on the same Coolify box (folium, ilizwi, vaultstream, stockflow-zw, saylor-beauty-spa, or the unmanaged `medka...`/`qf6k...`/`gated-community-system-*` apps).
- Do not use GitHub Actions anywhere — Coolify's native webhook only.
- Do not run destructive commands against `173.220.84.245` or `173.212.195.88` (no `docker rm`, no file deletion) without explicit user confirmation first — read-only investigation only in this sprint.
- Do not change `DATABASE_URL`/`REDIS_URL` on the working `zimhealth-api`/`zimhealth-web` apps — they're already correct.

## Acceptance criteria
- [ ] A trivial commit pushed to `main` triggers an automatic Coolify redeployment of `zimhealth-api` and `zimhealth-web`, observable in the Coolify UI/API without a manual click.
- [ ] `apps/whatsapp-bot` runs as a Coolify application, reachable/healthy, safely in dry-run mode with no WhatsApp credentials set.
- [ ] `deploy-server.sh` carries a clear deprecation notice, or is confirmed still needed and left alone with a note explaining why.
- [ ] `coolify-infra/README.md` accurately reflects reality (no more "deployed via PM2+rsync, not this API" — that's now false).

## Verification
- Push a no-op commit (e.g. a comment) to `main`, watch `GET /applications/{uuid}` (or the Coolify UI) for a new deployment firing within the webhook delay.
- `curl https://<bot-app-uuid>.31.220.84.245.sslip.io/health` (or whatever health route `apps/whatsapp-bot` exposes) returns 200.
- Re-run the same login + `/api/admin/stats` smoke test used to verify this sprint's findings, after any change, to confirm nothing regressed.
