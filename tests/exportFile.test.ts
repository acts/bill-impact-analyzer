import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAnswer, reviewDrivers } from "@/lib/drivers";
import { buildExport, compareExports, parseExport, toMarkdown, INTERNAL_MARK } from "@/lib/exportFile";
import { parseRubric } from "@/lib/rubric";
import { score } from "@/lib/score";

const a = parseAnswer(readFileSync("tests/fixtures/answer.json", "utf8"));
const r = parseRubric(readFileSync("tests/fixtures/rubric.fixture.json", "utf8"));
if (!a.ok || !r.ok) throw new Error("fixtures");
const drivers = reviewDrivers(a.answer, null);
const result = score(drivers, r.rubric);
const meta = { id: "202520260AB999", label: "AB 999, 2025–26", version: "Amended in Assembly March 12, 2026", url: null };
const now = new Date("2026-11-19T12:00:00Z");

describe("exports (FR-10, S-8)", () => {
  it("full export carries the internal notice and totals", () => {
    const e = buildExport(meta, drivers, result, "full", now);
    expect(e.notice).toBe(INTERNAL_MARK);
    expect(e.score?.teams.find((t) => t.team === "development")?.one_time_hours).toBe(480);
    const md = toMarkdown(e);
    expect(md).toContain(INTERNAL_MARK);
    expect(md).toContain("| Development | yes | 480 | 160 |");
  });
  it("drivers-only export has no staffing numbers", () => {
    const e = buildExport(meta, drivers, result, "drivers_only", now);
    expect(e.score).toBeNull();
    const text = JSON.stringify(e) + toMarkdown(e);
    expect(text).not.toMatch(/IT Specialist|hours_per_position|one_time_hours|Internal/);
  });
  it("escapes table-breaking characters from model text", () => {
    const evil = [{ ...drivers[0], summary: "a | b\n| injected | row |" }];
    const md = toMarkdown(buildExport(meta, evil, null, "drivers_only", now));
    expect(md).toContain("a \\| b \\| injected \\| row \\|");
  });
  it("round-trips through parseExport and rejects foreign files", () => {
    const e = buildExport(meta, drivers, result, "full", now);
    expect(parseExport(JSON.stringify(e)).ok).toBe(true);
    expect(parseExport('{"hello":"world"}').ok).toBe(false);
    expect(parseExport("not json").ok).toBe(false);
  });
});

describe("compare (FR-9)", () => {
  it("shows added and removed drivers and hour changes after an amendment", () => {
    const before = buildExport(meta, drivers, result, "full", now);
    const amended = drivers.filter((d) => d.code !== "CLIENT_NOTICE");
    const after = buildExport(meta, amended, score(amended, r.rubric), "full", now);
    const c = compareExports(before, after);
    expect(c.added).toHaveLength(0);
    expect(c.removed.map((d) => d.code)).toEqual(["CLIENT_NOTICE"]);
    expect(c.teamDeltas?.find((t) => t.team === "development")).toEqual({ team: "development", oneTime: -80, ongoing: 0 });
  });
});
