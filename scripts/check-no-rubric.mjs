#!/usr/bin/env node
/**
 * S-7: fail the build if a real rubric could be committed.
 *
 * 1. Any tracked file named like rubric*.json other than the allowed example/fixture files fails.
 * 2. Any tracked .json file containing "hours_per_position" outside the allowed paths fails
 *    (catches a rubric saved under another name).
 * Allowed: public/rubric.example.json, tests/fixtures/rubric.fixture.json
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED = new Set(["public/rubric.example.json", "tests/fixtures/rubric.fixture.json"]);

let files;
try {
  files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
} catch {
  console.error("check-no-rubric: not a git repository");
  process.exit(2);
}

const problems = [];
for (const f of files) {
  if (ALLOWED.has(f) || f.startsWith("node_modules/")) continue;
  const base = f.split("/").pop() ?? "";
  if (/^rubric.*\.json$/i.test(base)) problems.push(`${f}: rubric files must stay on your computer`);
  else if (f.endsWith(".json")) {
    let text = "";
    try {
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (text.includes('"hours_per_position"')) problems.push(`${f}: looks like a rubric (has hours_per_position)`);
  }
}

if (problems.length) {
  console.error("Rubric guard failed. Real staffing numbers must never be committed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`check-no-rubric: ok (${files.length} files checked)`);
