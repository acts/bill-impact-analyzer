import type { ReviewedDriver } from "./drivers";
import type { Classification, Rubric, Rule } from "./rubric";
import { DRIVERS, TEAMS, type Team } from "./taxonomy";

/**
 * Part 2: drivers × rubric → staffing. Pure, deterministic code (NFR-8): the same drivers and
 * the same rubric always produce the same numbers. No AI is involved here.
 */

export interface ScoreLine {
  driverId: string;
  code: string;
  section: string;
  classification: Classification;
  hours: number;
  recurring: boolean;
  lowConfidence: boolean;
}

export interface ClassTotal {
  classification: Classification;
  oneTimeHours: number;
  ongoingHours: number;
}

export type Impact = "yes" | "maybe" | "no";

export interface TeamResult {
  team: Team;
  impact: Impact;
  lines: ScoreLine[];
  byClass: ClassTotal[];
  oneTimeHours: number;
  ongoingHours: number;
  /** positions = hours / hours_per_position, rounded to 2 decimals */
  oneTimePositions: number;
  ongoingPositions: number;
  /** drivers with no rubric rule that usually involve this team */
  unscored: string[];
}

export interface ScoreResult {
  rubricVersion: string;
  hoursPerPosition: number;
  teams: TeamResult[];
  unscored: ReviewedDriver[];
  deadlines: { section: string; date: string | null; summary: string }[];
  noImpactOnly: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ruleMatches(rule: Rule, d: ReviewedDriver): boolean {
  if (rule.code !== d.code) return false;
  if (rule.when?.frequency && !rule.when.frequency.includes(d.frequency)) return false;
  if (rule.when?.confidence && !rule.when.confidence.includes(d.confidence)) return false;
  return true;
}

/** First matching rule wins, so put specific rules before general ones. */
export function findRule(rubric: Rubric, d: ReviewedDriver): Rule | null {
  return rubric.rules.find((r) => ruleMatches(r, d)) ?? null;
}

const MODIFIERS = new Set(["DEADLINE", "NO_IT_IMPACT"]);

export function score(drivers: ReviewedDriver[], rubric: Rubric): ScoreResult {
  const lines: Record<Team, ScoreLine[]> = { development: [], project_management: [], operations: [], security: [] };
  const unscored: ReviewedDriver[] = [];
  const deadlines: ScoreResult["deadlines"] = [];

  for (const d of drivers) {
    if (d.code === "DEADLINE") {
      deadlines.push({ section: d.section, date: d.effective_date, summary: d.summary });
      continue;
    }
    if (MODIFIERS.has(d.code)) continue;
    const rule = findRule(rubric, d);
    if (!rule) {
      unscored.push(d);
      continue;
    }
    for (const team of TEAMS) {
      for (const s of rule.teams[team] ?? []) {
        lines[team].push({
          driverId: d.id,
          code: d.code,
          section: d.section,
          classification: s.class,
          hours: s.hours,
          recurring: rule.recurring,
          lowConfidence: d.confidence === "low",
        });
      }
    }
  }

  const teams: TeamResult[] = TEAMS.map((team) => {
    const tl = lines[team];
    const map = new Map<Classification, ClassTotal>();
    for (const l of tl) {
      const t = map.get(l.classification) ?? { classification: l.classification, oneTimeHours: 0, ongoingHours: 0 };
      if (l.recurring) t.ongoingHours += l.hours;
      else t.oneTimeHours += l.hours;
      map.set(l.classification, t);
    }
    const byClass = [...map.values()];
    const oneTimeHours = byClass.reduce((a, c) => a + c.oneTimeHours, 0);
    const ongoingHours = byClass.reduce((a, c) => a + c.ongoingHours, 0);
    const teamUnscored = unscored
      .filter((d) => DRIVERS.find((x) => x.code === d.code)?.usualTeams.includes(team))
      .map((d) => d.id);
    const hasHours = oneTimeHours + ongoingHours > 0;
    const allLow = tl.length > 0 && tl.every((l) => l.lowConfidence);
    const impact: Impact = hasHours && !allLow ? "yes" : hasHours || teamUnscored.length > 0 ? "maybe" : "no";
    return {
      team,
      impact,
      lines: tl,
      byClass,
      oneTimeHours,
      ongoingHours,
      oneTimePositions: round2(oneTimeHours / rubric.hours_per_position),
      ongoingPositions: round2(ongoingHours / rubric.hours_per_position),
      unscored: teamUnscored,
    };
  });

  return {
    rubricVersion: rubric.rubric_version,
    hoursPerPosition: rubric.hours_per_position,
    teams,
    unscored,
    deadlines,
    noImpactOnly: drivers.length > 0 && drivers.every((d) => d.code === "NO_IT_IMPACT"),
  };
}
