# Handover — Bill Impact Analyzer

## What it is

Personal tool for CDSS ISD bill analysis: bill → AI-extracted workload drivers (checked against the bill) → staffing by team and classification from a private local rubric. See `README.md`.

## Operating cost (Readiness 1.11 habit)

As of 2026-11-19: **$0/month.** Vercel Hobby; no APIs; the AI is your existing Copilot or chat subscription.

## Data inventory (Readiness 0.11)

| Data | Personal data? | Where it lives | Retention / deletion |
| --- | --- | --- | --- |
| Bill text | No (public record) | Fetched per request; Vercel edge cache | Cache expires in 30–90 min |
| Bill IDs requested | No | Vercel request logs | Vercel's log retention (Hobby: short) |
| Client IP (rate limiter) | IP address | Function memory only, ≤ 60 s, ≤ 5,000 entries | Dropped on the next window or instance recycle |
| Pasted AI answer, drivers | No | Browser tab memory | Gone when the tab closes |
| Rubric | No PII; **internal workload data** | Your computer; browser tab memory while in use | Never stored by the app |
| Exports | No PII; internal when "full" | Your downloads folder | Yours to manage |

No accounts, cookies, analytics or third-party processors. Vercel is the only processor (hosting).

## Known gaps

See `docs/READINESS.md` → Honest gaps.

## Second operator

Bus factor = 1, accepted (Class C).
