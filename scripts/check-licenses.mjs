#!/usr/bin/env node
/**
 * Readiness 0.12: scan production dependencies and fail on copyleft or unknown licenses.
 * Writes a dated report to docs/evidence/licenses-YYYY-MM-DD.txt when run with --write.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BLOCKED = /\b(A?GPL|LGPL|SSPL|EUPL|CC-BY-NC|CC-BY-SA|BUSL|Commons Clause)\b/i;

const out = execFileSync("npx", ["license-checker-rseidelsohn", "--production", "--json", "--excludePrivatePackages"], {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});
const data = JSON.parse(out);
const rows = Object.entries(data).map(([pkg, info]) => [pkg, String(info.licenses ?? "UNKNOWN")]);
const exceptions = JSON.parse(readFileSync("license-exceptions.json", "utf8")).exceptions;
const excepted = (pkg, lic) => exceptions.some((e) => new RegExp(e.match).test(pkg) && e.license === lic);
const flagged = rows.filter(([, lic]) => BLOCKED.test(lic) || /UNKNOWN|UNLICENSED/i.test(lic));
const bad = flagged.filter(([p, l]) => !excepted(p, l));
const accepted = flagged.filter(([p, l]) => excepted(p, l));
const counts = rows.reduce((m, [, l]) => m.set(l, (m.get(l) ?? 0) + 1), new Map());

const report = [
  `License scan ${new Date().toISOString().slice(0, 10)} — ${rows.length} production packages`,
  ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `  ${l}: ${n}`),
  accepted.length ? `Accepted exceptions (license-exceptions.json):\n${accepted.map(([p, l]) => `  ${p}: ${l}`).join("\n")}` : "Accepted exceptions: none",
  bad.length ? `FLAGGED:\n${bad.map(([p, l]) => `  ${p}: ${l}`).join("\n")}` : "Flagged: none",
].join("\n");

if (process.argv.includes("--write")) {
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(`docs/evidence/licenses-${new Date().toISOString().slice(0, 10)}.txt`, report + "\n");
}
console.log(report);
process.exit(bad.length ? 1 : 0);
