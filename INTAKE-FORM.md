# Intake Form — Bill Impact Analyzer
*Step 1 of the App Playbook. Class C: this form is the brief.*

**Date:** 2026-11-19  **Intake owner:** Claude (build partner)  **Requester / sponsor:** Jeff

## 1. The problem
- Problem in one sentence: Each bill in session must be read by hand to decide whether ISD's Development, PM, Operations or Security teams need resources, and at which IT classification.
- Who has it: Jeff, ISD analyst for CDSS legislative bill analysis.
- How solved today: Read bill text, analyses and amendments manually; estimate from experience.
- Cost of not solving: Analyst hours per bill, repeated on each amendment; inconsistent estimates across bills. (Hours per bill today: not yet measured.)
- Evidence the problem is real: It is Jeff's recurring legislative-season work.

## 2. The proposed product
- Working name: Bill Impact Analyzer (internal; no domain or trademark needed — quiet tool)
- One-sentence pitch: Paste a bill, get a cited, editable list of IT workload drivers and a staffing worksheet from your own rubric.
- Beats the substitute on: Consistency — the same driver always maps to the same staffing, every line cited to the bill.
- Explicitly NOT a user: The public, other agencies, anyone without Jeff's rubric.

## 3. Engagement class
☒ **C — Personal / experimental** (climbs to B, or to an agency-hosted build, before anyone else relies on it)

## 4. Users & money
- Primary user: Jeff. Secondary: none.
- Who pays: nobody. Pricing model: ☒ free. $0 rule applies.

## 5. Success definition
- Primary metric: minutes from bill URL to a draft worksheet.
- Guardrails: drivers added by hand (misses) / drivers deleted (false positives).
- Review date: end of the first policy-committee deadline of the 2027 session — continue / pivot / kill.

## 6. Data & regulatory seed
- Personal data: none (no accounts). Rate limiter holds IPs in memory for ≤ 60 s.
- ☐ minors ☐ health ☐ payments ☐ precise location ☐ user-uploaded content stored ☐ client records — none
- Data the AI must NEVER receive: the rubric, hours, classification mix, team sizes, internal system names, past internal analyses.
- Jurisdiction: California. Agency GenAI guidance governs how outputs are used at work.

## 7. AI involvement
☒ AI feature: driver extraction from public bill text, via the analyst's own AI chat (copy/paste; no API calls in v1).
- Model candidates: Copilot Chat (work), Claude, Gemini, ChatGPT (testing). Human-in-the-loop: ☒ yes — every driver is reviewed and editable.
- Eval set: ☒ required before real use — `evals/` (4 of 12 cases built).

## 8. Constraints
- Deadline: before the 2027 legislative season. Budget: $0.
- Must-avoid: storing or transmitting the rubric; third-party scripts.
- Devices: desktop Edge/Chrome (work and home).

## 9. Name & domain check
- Domain: N/A (quiet tool, `vercel.app`). ☒ Name passes the defensibility test.

## 10. Gate G0
- Decision: ☒ approve to PRD — Jeff, 2026-11-19 ("ok let's build it then")
- Scope approved: paste URL → extract drivers via own AI → validate and quote-check → score with local rubric → export/compare.
- Declined at intake: server-side AI calls (v1), storing the rubric or analyses, automatic bill watching (v2 candidate), writing the final fiscal analysis.
