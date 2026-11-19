# Reliability — Bill Impact Analyzer

Every dependency and failure mode, with the designed behavior. Same-PR rule: a new dependency or failure mode adds a row here.

| Dependency / failure | What the user sees | Recovery |
| --- | --- | --- |
| leginfo down, slow (>10 s) or blocking Vercel | "Couldn't reach the Legislature's site… paste the bill text instead." Paste panel opens. | Paste path (FR-2) works with no server at all |
| leginfo changes its page HTML | Bill loads but shows the "couldn't find the Digest or enacting clause" warning | Paste text; fix `src/lib/billText.ts`; add the new HTML as a fixture |
| leginfo redirects off-host or returns non-HTML / >5 MB | Error message + paste option | By design (S-1) |
| Rate limit hit (20/min per instance; Firewall rule) | "Too many requests. Wait a minute." | Wait |
| AI returns prose, bad JSON, unknown codes, extra fields | Named errors + "Copy a fix-it prompt" | One repair attempt, else re-run or enter drivers by hand |
| AI invents a quote | Row highlighted, "Not found in bill" | Analyst checks the section, edits or removes |
| AI misses a driver | Not detectable automatically | Analyst review (FR-8); eval recall bar |
| Clipboard blocked by browser policy | Prompt box is selected for manual copy | Ctrl/Cmd+C |
| Rubric invalid | Named validation errors, nothing scored | Fix the file |
| Driver with no rubric rule | "Needs your estimate" on the team; listed under the table | Add a rule or estimate by hand |
| Vercel outage | Site down | Wait; nothing is lost because nothing is stored |
| Kill switch | v1 makes no AI calls, so there is nothing to disable (D-5) | — |
