# Product Requirements + App Flow — Bill Impact Analyzer

**Product:** Bill Impact Analyzer  **Intake form date:** 2026-11-19  **Class:** C  **Version:** 1.0

## 1. Users & jobs
| User / role | Job-to-be-done | How often | Device |
|---|---|---|---|
| Jeff (analyst) | "Tell me which ISD teams a bill hits, and roughly how much, with citations I can check." | Daily during session | Desktop Edge/Chrome |

## 2. Functional requirements
Each maps to automated tests (UAT = the test named).
- FR-1 — Load a bill by ID or leginfo link; the site fetches text and version. *Test:* `tests/billId.test.ts`, `tests/billText.test.ts`; live check on first preview.
- FR-2 — Paste bill text when the fetch fails. *Test:* `e2e/flow.spec.ts` (core loop uses the paste path).
- FR-3 — Build a copyable extraction prompt containing no rubric content. *Test:* `tests/prompt.test.ts`, e2e.
- FR-4 — Validate the pasted answer against the schema with plain errors and a fix-it prompt. *Test:* `tests/drivers.test.ts`.
- FR-5 — Verify each quote against the bill; flag unmatched. *Test:* `tests/drivers.test.ts`.
- FR-6 — Load `rubric.json` from disk into memory only, validated. *Test:* `tests/score.test.ts`; e2e asserts no storage/cookies.
- FR-7 — Score drivers into impact per team, classification, hours and positions. *Test:* `tests/score.test.ts` (fixture totals).
- FR-8 — Add, edit, remove drivers; edits marked. *Test:* export shows `edited_by_analyst`.
- FR-9 — Compare with an earlier export. *Test:* `tests/exportFile.test.ts` (compare).
- FR-10 — Export Markdown/JSON (internal) and drivers-only (shareable); nothing stored server-side. *Test:* `tests/exportFile.test.ts`.

## 3. Non-goals & declined requests
| Request / idea | Declined because | Decided |
|---|---|---|
| Server-side AI calls | Keys and a data path; copy/paste works with Copilot | 2026-11-19 (v1) |
| Storing rubric or analyses | Internal workload data | 2026-11-19 (permanent for Vercel build) |
| Auto-watch every bill | Needs scheduler + storage; after eval proves quality | 2026-11-19 (v2 candidate) |
| Writing the final fiscal analysis | AI drafts, analyst decides | 2026-11-19 (permanent) |

## 4. App flow map
**Entry:** bookmarked Vercel URL. No sign-in. **First run:** "Try the example rubric" button.
**Core loop:** 1. load/paste bill → 2. copy prompt → 3. paste AI answer → 4. review/edit drivers → 5. load rubric → 6. read worksheet, export → (amendment) compare with earlier export.
**Auth flow:** none (D-1). **Admin flow:** none. **Exit:** close the tab — everything is gone. **Notifications:** none.

## 5. State & unhappy-path checklist
| Screen / flow | Empty | Loading | Error | Provider down |
|---|---|---|---|---|
| Bill | Input with examples | "Fetching from the Legislature's site…" | Invalid ID / not found messages | Paste panel opens |
| Prompt | "Load a bill first." | — | Long-prompt warning + skip-digest option | — |
| Answer | Placeholder JSON | — | Named errors + fix-it prompt | AI outage: enter drivers by hand |
| Review | "Check an answer first." | — | Unverified quotes highlighted | — |
| Rubric | Load / try example | — | Named validation errors | — |
| Worksheet | "Review drivers and load a rubric…" | — | "Needs your estimate" for unscored drivers | — |
- Payment, email, concurrent editing: N/A. Lost device: nothing to lose. AI garbage: schema rejection; never rendered as HTML.

## 6. Non-functional requirements
- **Performance:** bill load < 5 s typical; scoring < 200 ms.
- **Accessibility:** WCAG 2.1 AA; axe in CI on `/` and the 404 page, zero critical/serious.
- **Security posture:** no auth (D-1); headers per Readiness 0.13; threat model in `docs/ARCHITECTURE.md` ☒
- **Privacy:** data inventory in `docs/HANDOVER.md` ☒; privacy/terms N/A (single user, D-2).
- **Platforms:** desktop Chrome/Edge. **Languages:** English, hardcoded (D-7). **Backups:** none needed (no state).

## 7. AI requirements
- Feature: driver extraction via the analyst's own AI; model decision pending eval (D-5).
- Sent: public bill text, driver list, instructions. Never sent: rubric, hours, classifications, team sizes, internal names.
- Human-in-the-loop: every driver reviewed/editable before scoring.
- Eval set: `evals/`; 4/12 cases; pass bar D-4; re-run on model or prompt change.
- Kill switch: no AI calls in the app (D-5). Cost: $0.

## 8. Analytics & measurement
Declined (D-2, S-4). Primary metric measured by Jeff's own timing at the review date.

## 9. Launch shape
Domain: none (D-2). Pricing: none. Support: N/A. Tier at launch: 0 (partial, gaps in READINESS). READINESS seeded ☒

## 10. Gate G1
- Jeff approval: ☒ 2026-11-19 ("ok let's build it then", after reviewing the plan doc)

## Change log
| Date | Requirement(s) | Change | Approved by |
|---|---|---|---|
| 2026-11-19 | FR-9 | Compare uses an earlier export file rather than fetching old bill versions (simpler; no extra leginfo calls) | Pending Jeff |
