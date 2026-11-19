# Bill Impact Analyzer

Turns a California bill into a **draft IT workload worksheet** for CDSS ISD's Development, Project Management, Operations and Security teams. Personal tool, Class C under the Acts Nine App Playbook.

**How it works, in two parts**

1. **Extract (public data only).** Paste a bill ID or leginfo link. The site fetches the bill text and builds a prompt. You paste the prompt into Copilot (or another AI chat) and paste the JSON answer back. The site validates it and checks every quote against the bill.
2. **Score (local only).** Load your `rubric.json` from your own computer. The page maps each driver to classifications and hours with plain code. Your rubric is never uploaded, never stored, and the page's Content-Security-Policy blocks it from being sent anywhere.

**What it stores: nothing.** No database, no accounts, no secrets.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Run locally | `npm run dev` (http://localhost:3000) |
| Unit tests | `npm test` |
| Browser + accessibility tests | `npm run build && npm run test:e2e` (set `CHROME_PATH` to use an installed Chrome) |
| Typecheck / lint | `npm run typecheck` / `npm run lint` |
| Rubric guard | `npm run check:rubric` |
| License scan | `npm run check:licenses` |
| AI eval | see `evals/README.md` |

## Your rubric

Start from `public/rubric.example.json` (made-up numbers). Save your real one **outside this repo** (for example in your work OneDrive). `.gitignore` and the CI rubric guard both refuse rubric files, but don't rely on them: keep it out of the folder.

## Docs

`docs/ARCHITECTURE.md` · `docs/DEPLOYMENT.md` · `docs/RELIABILITY.md` · `docs/TROUBLESHOOTING.md` · `docs/DECISIONS.md` · `docs/HANDOVER.md` · `docs/READINESS.md` · `docs/LAUNCH-SURFACE-CHECKLIST.md` · founding docs: `INTAKE-FORM.md`, `PRODUCT-REQUIREMENTS-AND-FLOW.md`.
