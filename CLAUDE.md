# CLAUDE.md — Bill Impact Analyzer

## What this is

Personal web tool that turns a California bill into a draft IT workload worksheet (Development, PM, Operations, Security × IT classifications) for CDSS ISD legislative analysis. Next.js on Vercel; public bill data only server-side; the private rubric stays in the browser.

- **Engagement class:** C — Personal (climbs to B, or moves to an agency-hosted build, before anyone else relies on it)
- **Delivery phase:** Build (Phase 4) → Verify (Phase 5). Eval set is 4 of 12 cases.

## Run, test, deploy

- **Install:** `npm ci`
- **Run locally:** `npm run dev`
- **Test:** `npm test` (unit) and `npm run build && npm run test:e2e` (browser + axe)
- **Build:** `npm run build`
- **Deploy:** see `docs/DEPLOYMENT.md` (Vercel, Git integration)

## Repo map

- `src/lib/` — bill ID parsing, HTML→text, driver schema + quote check, rubric schema, scoring, exports
- `src/lib/server/` — the only outbound fetch (leginfo, SSRF-locked) and the rate limiter
- `src/prompts/extract.ts` — the versioned extraction prompt (prompts are code)
- `src/app/` — the single-page UI, `/api/bill`, robots, 404; `src/proxy.ts` sets the nonce CSP
- `tests/`, `e2e/` — unit tests; Playwright flow + CSP + axe tests
- `evals/` — AI eval cases and run reports
- `scripts/` — rubric guard, license scan, eval scorer
- `docs/` — the FDE pack and project documents

## Rules that bind any programmer on this repo

- **Jeff approves merges.** Nothing merges to main without Jeff's approval.
- **The rubric never enters this repo, a prompt, a log, or the server.** Only `public/rubric.example.json` and `tests/fixtures/rubric.fixture.json` (made-up numbers) may exist. Never add a feature that persists or transmits rubric content; never loosen `connect-src 'self'`.
- **No third-party scripts, fonts, analytics or embeds** (S-4). No `dangerouslySetInnerHTML` (lint enforces it).
- **The server fetches only from leginfo, only by validated bill ID.** Never accept a URL from the client.
- **Prompt changes bump `PROMPT_VERSION` and re-run the eval set.**
- **Docs ship in the same pull request.** New dependency or failure mode → a row in `docs/RELIABILITY.md` in that PR.
- **Readiness obligations.** Tier 0 partial today. Don't break the evidence (headers by GET, axe in CI, rubric guard, gitleaks).
- **Zero spend by default.**
- **Leave the baton.** Rewrite Current State and add a `docs/HANDOFF-LOG.md` entry at every stop.

## Current State

- **Where things stand:** v0.1 built: all of FR-1–FR-10. 45 unit tests and 4 browser tests pass locally; production build clean; headers verified by GET on a local production server.
- **Mid-flight:** PR #1 (`initial-build`) awaiting Jeff's review; not yet deployed to Vercel.
- **Next task:** connect the repo to Vercel, add the Firewall rate-limit rule, verify a real bill loads (leginfo was unreachable from the build sandbox), file headers evidence from production.
- **Known gotchas:** the leginfo HTML parser was built against known markers, not a live page — confirm on the first preview and adjust `src/lib/billText.ts` if `structured` comes back false. Playwright reuses a running server locally; kill stale `next start` processes after rebuilding.

## Pointers

- Architecture: `docs/ARCHITECTURE.md` · Readiness: `docs/READINESS.md` · Decisions: `docs/DECISIONS.md`
- Handover: `docs/HANDOVER.md` · Handoff log: `docs/HANDOFF-LOG.md` · Deployment: `docs/DEPLOYMENT.md` · Reliability: `docs/RELIABILITY.md`
