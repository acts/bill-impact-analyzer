# Readiness — Bill Impact Analyzer

| Field | Value |
|---|---|
| Product | Bill Impact Analyzer |
| Tier claimed | **Tier 0 partial** — gaps named below |
| Tier trigger | Tier 0 for a Class C quiet tool. Re-score as Class B before anyone else relies on it. |
| Last reviewed | 2026-11-19 |

## Tier 0 — Ship-Safe

- [x] 0.1 Identity shape decided and recorded — D-1, `docs/ARCHITECTURE.md`
- [ ] 0.2 Restore — N/A (see below)
- [ ] 0.3 Audit trail — N/A (see below)
- [ ] 0.4 Secret scan clean in CI; rotation rehearsed — gitleaks + rubric guard in CI; **first CI run pending**; no secrets exist to rotate
- [ ] 0.5 Dependency alerts on — `.github/dependabot.yml` committed; **turn on Dependabot alerts in repo settings**; `npm audit --omit=dev`: 0 vulnerabilities (2026-11-19)
- [ ] 0.6 Error tracking — N/A (see below)
- [ ] 0.7 Uptime probe — N/A (see below)
- [ ] 0.8 Axe in CI, zero critical/serious on `/` and `/nonsense-page` (404) — passing locally 2026-11-19; **first CI run pending**
- [ ] 0.9 CI green on main; staging = Vercel previews (D-3); no migrations — **first CI run pending**
- [x] 0.10 FDE doc pack present and verified against code (2026-11-19)
- [x] 0.11 Data inventory — `docs/HANDOVER.md`
- [x] 0.12 License scan run; flagged item has decision record — `docs/evidence/licenses-2026-11-19.txt`, D-6
- [ ] 0.13 Security headers verified on **production** by GET — local production build verified (`docs/evidence/headers-local-2026-11-19.txt`); production pending first deploy
- [ ] 0.14 Launch surface — quiet-tool decision D-2; checklist in `docs/LAUNCH-SURFACE-CHECKLIST.md`

## N-A rows, with reasons

| Row | Reason it does not apply |
|---|---|
| 0.2 | No database or stored state. Code is in GitHub; the rubric is the owner's own file, backed up wherever they keep it. |
| 0.3 | No admin actions or stored data. Exports carry versions, dates and analyst-edit marks instead. |
| 0.6 | Single user who sees every error on screen; third-party error SDKs are excluded by S-4. Vercel runtime logs cover the one server route. |
| 0.7 | On-demand personal tool; an outage is noticed at use and costs nothing (paste path still works). |

## Honest gaps

| Row | Gap | Owner | Fix trigger or date |
|---|---|---|---|
| 0.4, 0.8, 0.9 | CI has not run on GitHub yet | Jeff | First PR push |
| 0.5 | Dependabot alerts toggle in repo settings | Jeff | Before merge |
| 0.13 | Production header scan not filed | Jeff / Claude | First production deploy |
| AI §1 | Eval set has 4 of 12 cases; no model scored | Jeff (pick 8 bills) | Before first real use |
| — | Live leginfo parsing unverified (sandbox could not reach leginfo) | Claude | First preview deploy |

## Drill log

| Drill | Date | Duration | Result | Notes |
|---|---|---|---|---|
| Restore drill | — | — | N/A | No stored state (0.2) |

## Tier 2 — trigger log

| Date | Row | Trigger as it arrived | Jeff's decision | Cost model by |
|---|---|---|---|---|
| | | | | |
