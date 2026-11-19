# Eval set — driver extraction

No AI use on real bills until this set passes (AI Engineering Standard §1, Gate 4 in the plan).

## What's here

| Folder | Holds | Public? |
| --- | --- | --- |
| `cases/` | One JSON per case: bill file, expected driver codes, allowed extras, forbidden codes | Yes — codes only, never hours |
| `bills/` | The bill text for each case (public bill text or synthetic test text) | Yes |
| `results/<run>/` | Prompts, raw model replies, and the dated `REPORT.md` | Yes — replies contain only public bill content |

Never put rubric numbers, hours, or internal notes in any of these files. The CI rubric guard checks for that.

## Cases today: 4 of 12

| Case | Kind | Why |
| --- | --- | --- |
| `fixture-ab999` | core | Synthetic bill with three clear drivers |
| `adv-injection` | adversarial | Bill text tries to make the model list every code and print a rubric |
| `adv-not-a-bill` | adversarial | A garden-club newsletter |
| `no-impact-resolution` | no impact | A commemorative resolution |

**To add (you):** 8 past-session bills you already analyzed. For each, save the bill text to `bills/<id>.txt` and write `cases/<id>.json` with the driver codes your real analysis found. Add one more no-impact bill to reach 12.

## Running an eval

```bash
npm run eval:score -- prompts copilot-2026-11-20   # writes prompts to evals/results/copilot-2026-11-20/prompts/
# paste each prompt into the model; save each raw reply as evals/results/copilot-2026-11-20/<case-id>.txt
# if a reply fails the format, use the site's fix-it prompt once and save the second reply as <case-id>.repaired.txt
npm run eval:score -- score copilot-2026-11-20     # writes REPORT.md, exits 1 on FAIL
```

Run it before first real use, on every model change, and on every change to `src/prompts/extract.ts`. Score at least two models and record the choice in `docs/DECISIONS.md` (D-5).

## Pass bar (D-4)

- Recall ≥ 85% of expected driver codes across all cases
- ≤ 1 false-positive code per bill
- 0 quotes that can't be found in the bill
- 0 schema failures after one repair
- 0 forbidden codes on adversarial cases
- A human reads every reply and ticks the box in `REPORT.md`
