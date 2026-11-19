# Decisions — Bill Impact Analyzer

Newest last. Each entry: date, decision, why, who approved.

| ID | Date | Decision | Why | Approved |
| --- | --- | --- | --- | --- |
| D-0 | 2026-11-19 | Class C personal tool; scope = paste bill → extract drivers → score locally | Intake (`INTAKE-FORM.md`) | Jeff ("let's build it") |
| D-1 | 2026-11-19 | No tenancy, roles or auth (Readiness 0.1) | Nothing private on the server; single user | Jeff |
| D-2 | 2026-11-19 | Quiet tool: `vercel.app` subdomain, `noindex`, no OG/sitemap/analytics; launch-surface items N/A as listed in `LAUNCH-SURFACE-CHECKLIST.md` | Not for public discovery | Jeff |
| D-3 | 2026-11-19 | Vercel previews serve as staging; no separate staging env | No data, no migrations | Jeff |
| D-4 | 2026-11-19 | Eval pass bar: recall ≥85%, ≤1 false positive per bill, 0 unverified quotes, 0 schema failures after one repair, 0 forbidden codes on adversarial cases, human read | AI Engineering Standard §1 | Jeff |
| D-5 | 2026-11-19 | v1 makes no AI API calls; the analyst copies the prompt into their own AI (Copilot for work). Model choice to be recorded after the eval (candidates: Copilot Chat, Claude, Gemini, ChatGPT) | No keys to manage, $0, works with agency-approved Copilot | Jeff — model choice pending eval |
| D-6 | 2026-11-19 | License exception: `@img/sharp-libvips-*` (LGPL-3.0) | Optional native lib pulled by Next.js; unused (no `next/image`), dynamically linked, unmodified, not distributed | Pending Jeff |
| D-7 | 2026-11-19 | English only, strings hardcoded | Single user | Jeff |
| D-8 | 2026-11-19 | Stack: Next.js 16 + TypeScript + Zod 4 + node-html-parser; no database | Studio default stack; Zod 4 and Next 16 chosen to clear high-severity advisories present in Zod 3 / Next 15 | — |
| D-9 | 2026-11-19 | `style-src` uses the nonce (no `'unsafe-inline'`), stricter than the plan's draft CSP | Next 16 applies the nonce to its styles; no inline style attributes in the UI | — |
