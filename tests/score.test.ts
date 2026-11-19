import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAnswer, reviewDrivers } from "@/lib/drivers";
import { parseRubric } from "@/lib/rubric";
import { score } from "@/lib/score";

const rubricText = readFileSync("tests/fixtures/rubric.fixture.json", "utf8");
const answer = parseAnswer(readFileSync("tests/fixtures/answer.json", "utf8"));

function setup() {
  const r = parseRubric(rubricText);
  if (!r.ok || !answer.ok) throw new Error("fixtures invalid");
  return { rubric: r.rubric, drivers: reviewDrivers(answer.answer, null) };
}

describe("parseRubric (FR-6)", () => {
  it("accepts the fixture and the shipped example", () => {
    expect(parseRubric(rubricText).ok).toBe(true);
    expect(parseRubric(readFileSync("public/rubric.example.json", "utf8")).ok).toBe(true);
  });
  it("rejects unknown classifications, negative hours, unknown fields and pollution keys", () => {
    const base = JSON.parse(rubricText);
    const bad = (mut: (r: any) => void) => {
      const r = structuredClone(base);
      mut(r);
      return parseRubric(JSON.stringify(r)).ok;
    };
    expect(bad((r) => (r.rules[0].teams.development[0].class = "Wizard"))).toBe(false);
    expect(bad((r) => (r.rules[0].teams.development[0].hours = -5))).toBe(false);
    expect(bad((r) => (r.rules[0].teams.marketing = []))).toBe(false);
    expect(bad((r) => (r.secret = 1))).toBe(false);
    expect(parseRubric('{"__proto__":{"x":1},"rubric_version":"1","hours_per_position":1,"rules":[]}').ok).toBe(false);
  });
  it("rejects files over 1 MB", () => {
    expect(parseRubric(" ".repeat(1_000_001)).ok).toBe(false);
  });
});

describe("score (FR-7, NFR-8)", () => {
  it("produces the expected totals for the fixture bill", () => {
    const { rubric, drivers } = setup();
    const res = score(drivers, rubric);
    const t = Object.fromEntries(res.teams.map((x) => [x.team, x]));
    expect(t.development.oneTimeHours).toBe(480); // notice 80 + data sharing 400
    expect(t.development.ongoingHours).toBe(160); // annual report
    expect(t.development.oneTimePositions).toBe(0.27);
    expect(t.development.ongoingPositions).toBe(0.09);
    expect(t.operations.ongoingHours).toBe(40);
    expect(t.security.oneTimeHours).toBe(120);
    expect(t.project_management.impact).toBe("no");
    expect(t.development.impact).toBe("yes");
    expect(res.deadlines).toEqual([{ section: "Sec. 1, WIC 11450.5(b)", date: "2027-07-01", summary: "Notices due" }]);
    expect(res.unscored).toHaveLength(0);
  });
  it("is deterministic", () => {
    const { rubric, drivers } = setup();
    expect(JSON.stringify(score(drivers, rubric))).toBe(JSON.stringify(score(drivers, rubric)));
  });
  it("uses the first matching rule (specific before general)", () => {
    const { rubric, drivers } = setup();
    const oneTimeReport = drivers.map((d) => (d.code === "NEW_REPORT" ? { ...d, frequency: "one_time" as const } : d));
    const dev = score(oneTimeReport, rubric).teams.find((x) => x.team === "development")!;
    expect(dev.ongoingHours).toBe(0);
    expect(dev.oneTimeHours).toBe(580);
  });
  it("lists drivers with no rule as needing an estimate and marks teams maybe", () => {
    const { rubric, drivers } = setup();
    const res = score([...drivers, { ...drivers[0], id: "x", code: "PII_HANDLING" }], rubric);
    expect(res.unscored.map((d) => d.code)).toEqual(["PII_HANDLING"]);
    const sec = res.teams.find((x) => x.team === "security")!;
    expect(sec.unscored).toEqual(["x"]);
  });
  it("marks a team maybe when all its hours come from low-confidence drivers", () => {
    const { rubric, drivers } = setup();
    const low = drivers.map((d) => (d.code === "DATA_SHARING" ? { ...d, confidence: "low" as const } : d));
    expect(score(low, rubric).teams.find((x) => x.team === "security")!.impact).toBe("maybe");
  });
});
