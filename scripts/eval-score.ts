/**
 * Eval harness (AI Engineering Standard §1).
 *
 *   npm run eval:score -- prompts <run-name>   writes one prompt per case to evals/results/<run>/prompts/
 *   (paste each prompt into the model; save each raw reply as evals/results/<run>/<case-id>.txt;
 *    if you used the fix-it prompt once, save the second reply as <case-id>.repaired.txt)
 *   npm run eval:score -- score <run-name>     scores the replies and writes evals/results/<run>/REPORT.md
 *
 * Pass bar (docs/DECISIONS.md D-4): recall >= 85% overall, <= 1 false positive per bill,
 * 0 fabricated quotes, 0 schema failures after one repair, 0 forbidden codes on adversarial cases.
 * A human still reads every output — the report lists each one for that.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAnswer, verifyQuote } from "../src/lib/drivers";
import { buildExtractionPrompt, PROMPT_VERSION } from "../src/prompts/extract";

interface Case {
  id: string;
  kind: "core" | "adversarial" | "no_impact";
  bill_file: string;
  description: string;
  expected_codes: string[];
  allowed_extra_codes: string[];
  must_not_codes: string[];
}

const [mode, run] = process.argv.slice(2);
if (!mode || !run || !/^[\w.-]+$/.test(run)) {
  console.error("usage: npm run eval:score -- <prompts|score> <run-name>");
  process.exit(2);
}

const cases: Case[] = readdirSync("evals/cases")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join("evals/cases", f), "utf8")));
const dir = join("evals/results", run);
const billText = (c: Case) => readFileSync(join("evals/bills", c.bill_file), "utf8");

if (mode === "prompts") {
  mkdirSync(join(dir, "prompts"), { recursive: true });
  for (const c of cases) {
    writeFileSync(join(dir, "prompts", `${c.id}.txt`), buildExtractionPrompt({ billLabel: c.id, versionLabel: null, billText: billText(c) }));
  }
  console.log(`Wrote ${cases.length} prompts to ${join(dir, "prompts")}. Save each reply as ${dir}/<case-id>.txt`);
  process.exit(0);
}

if (mode !== "score") {
  console.error(`unknown mode ${mode}`);
  process.exit(2);
}

let expectedTotal = 0;
let foundTotal = 0;
const rows: string[] = [];
const failures: string[] = [];

for (const c of cases) {
  const repaired = join(dir, `${c.id}.repaired.txt`);
  const first = join(dir, `${c.id}.txt`);
  const file = existsSync(repaired) ? repaired : first;
  if (!existsSync(file)) {
    failures.push(`${c.id}: no reply saved`);
    rows.push(`| ${c.id} | ${c.kind} | missing | – | – | – | – |`);
    continue;
  }
  const parsed = parseAnswer(readFileSync(file, "utf8"));
  if (!parsed.ok) {
    failures.push(`${c.id}: schema failure${file === repaired ? " after repair" : ""}: ${parsed.errors[0]}`);
    rows.push(`| ${c.id} | ${c.kind} | FAIL | – | – | – | – |`);
    expectedTotal += c.expected_codes.length;
    continue;
  }
  const text = billText(c);
  const codes = parsed.answer.drivers.map((d) => d.code);
  const distinct = new Set(codes);
  const hit = c.expected_codes.filter((x) => distinct.has(x)).length;
  expectedTotal += c.expected_codes.length;
  foundTotal += hit;
  const allowed = new Set([...c.expected_codes, ...c.allowed_extra_codes]);
  const falsePos = [...distinct].filter((x) => !allowed.has(x));
  const forbidden = [...distinct].filter((x) => c.must_not_codes.includes(x));
  const fabricated = parsed.answer.drivers.filter((d) => d.code !== "NO_IT_IMPACT" && verifyQuote(d.quote, text) !== "verified");
  if (falsePos.length > 1) failures.push(`${c.id}: ${falsePos.length} false positives (${falsePos.join(", ")})`);
  if (forbidden.length) failures.push(`${c.id}: forbidden codes ${forbidden.join(", ")}`);
  if (fabricated.length) failures.push(`${c.id}: ${fabricated.length} quote(s) not found in the bill`);
  rows.push(
    `| ${c.id} | ${c.kind} | ok${file === repaired ? " (repaired)" : ""} | ${hit}/${c.expected_codes.length} | ${falsePos.join(", ") || "0"} | ${forbidden.join(", ") || "0"} | ${fabricated.length} |`,
  );
}

const recall = expectedTotal ? foundTotal / expectedTotal : 0;
if (recall < 0.85) failures.push(`overall recall ${(recall * 100).toFixed(0)}% is below 85%`);
const pass = failures.length === 0;
const today = new Date().toISOString().slice(0, 10);

const report = `# Eval report — ${run}

- Date: ${today}
- Prompt: ${PROMPT_VERSION}
- Cases: ${cases.length}
- Overall recall: ${(recall * 100).toFixed(0)}% (${foundTotal}/${expectedTotal})
- **Result: ${pass ? "PASS" : "FAIL"}** against the D-4 pass bar

| Case | Kind | Schema | Recall | False positives | Forbidden | Unverified quotes |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

${failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join("\n")}\n` : ""}
## Human read (required — AI Engineering Standard §1)

- [ ] I read every reply in this run. Reviewer: ______  Notes: ______
`;
writeFileSync(join(dir, "REPORT.md"), report);
console.log(report);
process.exit(pass ? 0 : 1);
