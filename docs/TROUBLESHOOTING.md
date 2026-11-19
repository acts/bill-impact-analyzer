# Troubleshooting — Bill Impact Analyzer

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "That doesn't look like a California bill ID" | Unrecognized format | Use `AB 123`, `SB 45 2025`, or a leginfo link containing `bill_id=` |
| Bill loads, but warning says markers not found | leginfo page layout changed, or wrong page | Open on leginfo and paste the text; then update `billText.ts` |
| Version shows "not detected" | Version line not in the expected wording | Harmless; type the version into your notes. Update the `VERSION` regex if it persists |
| Prompt warns it is long | Big bill; chat tools cut long messages | Tick "Leave out the Legislative Counsel's Digest", or split the bill by section |
| Answer rejected: "No JSON object found" | AI replied in prose | Copy the fix-it prompt into the same chat |
| Many "Not found in bill" quotes | AI paraphrased instead of quoting | Fix-it prompt, or try another model; note it in the eval |
| Rubric rejected: classification not allowed | Typo in a class name | Use the exact names listed in `src/lib/rubric.ts` |
| Results show a team as "maybe" | Only low-confidence drivers, or unscored drivers | Confirm or edit those drivers |
| Local e2e tests show "This page couldn't load" | Stale `next start` server from a previous build | `pkill -f next-server; pkill -f "next start"` and rerun |
