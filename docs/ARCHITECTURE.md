# Architecture — Bill Impact Analyzer

Verified against code on 2026-11-19.

## Shape

One Next.js 16 app on Vercel. No database, no auth, no environment variables.

| Part | Where it runs | Sees | Code |
| --- | --- | --- | --- |
| Bill fetch | Vercel function `GET /api/bill?id=<canonical id>` | A bill ID; public bill HTML from leginfo | `src/app/api/bill/route.ts`, `src/lib/server/leginfo.ts`, `src/lib/billText.ts` |
| Prompt builder | Browser | Public bill text + public driver list | `src/prompts/extract.ts` |
| AI extraction | **Your AI chat**, outside the app (copy/paste) | The prompt only | — |
| Driver check | Browser | The pasted AI answer + bill text | `src/lib/drivers.ts` |
| Scoring | Browser | Drivers + your rubric (memory only) | `src/lib/rubric.ts`, `src/lib/score.ts` |
| Export / compare | Browser → download | Drivers (+ totals for internal export) | `src/lib/exportFile.ts` |

## Identity shape (Readiness 0.1)

Single user, no tenancy, no roles, no authentication. Nothing server-side is private, so there is nothing to protect with a login. Recorded as D-1.

## Data flow and trust boundary

- The server only ever receives a bill ID matching `^\d{4}\d{4}\d(AB|SB|ACA|SCA|AJR|SJR|ACR|SCR|HR|SR)\d{1,5}$`. It builds the leginfo URL itself.
- The AI only ever receives public bill text and the driver list. `buildExtractionPrompt` has no rubric parameter; a test asserts no rubric terms appear.
- The rubric is read with the File API into React state. It is never written to storage, cookies, or the network. `connect-src 'self'` blocks any script from sending it elsewhere; an e2e test proves a cross-origin `fetch` is blocked.

## Threat model (lite)

| Abuse path | Mitigation | Evidence |
| --- | --- | --- |
| Bill route used for SSRF or as an open proxy | ID-only input; fixed host; manual redirects allowed only on the host over https; 5 MB / 10 s caps; HTML only; per-IP limiter + Vercel Firewall rule; edge cache | `tests/leginfo.test.ts`, `tests/billId.test.ts` |
| Rubric stolen by injected script or compromised dependency | Nonce CSP with `strict-dynamic`, `connect-src 'self'`, `img-src 'self' data: blob:`, `form-action 'self'`; no third-party code; no `dangerouslySetInnerHTML` (lint error); untrusted text rendered as text | `e2e/flow.spec.ts`, `src/proxy.ts` |
| Rubric leaked by the owner (git, prompt, export) | `.gitignore` + CI rubric guard + gitleaks; prompt has no rubric input; internal exports marked; drivers-only export | `scripts/check-no-rubric.mjs`, `tests/exportFile.test.ts` |
| Planted/garbled bill text yields wrong drivers | Fenced, defanged bill text; strict output schema; quote verification; analyst review and edit marks; eval adversarial cases | `tests/drivers.test.ts`, `tests/prompt.test.ts`, `evals/` |

## Headers

Set in `next.config.ts` (all routes) and `src/proxy.ts` (page CSP with nonce): CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP/CORP, `X-Robots-Tag: noindex`. API routes get `default-src 'none'`.
