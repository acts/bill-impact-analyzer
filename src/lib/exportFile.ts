import { z } from "zod";
import type { ReviewedDriver } from "./drivers";
import { safeJsonParse } from "./drivers";
import type { ScoreResult } from "./score";
import { TEAM_LABELS, TEAMS, TAXONOMY_VERSION, driverLabel } from "./taxonomy";
import { PROMPT_VERSION } from "@/prompts/extract";

/**
 * Exports are built in the browser and downloaded (S-8). They are never uploaded.
 * A "full" export contains rubric-derived numbers and is marked internal.
 * A "drivers_only" export has no staffing numbers and is safe to share.
 */

export const EXPORT_VERSION = "1";
export const INTERNAL_MARK = "Internal — contains staffing estimates. Do not post publicly.";

export interface BillMeta {
  id: string;
  label: string;
  version: string | null;
  url: string | null;
}

const ExportDriver = z.object({
  code: z.string().max(40),
  summary: z.string().max(400),
  section: z.string().max(200),
  quote: z.string().max(600),
  frequency: z.string().max(20),
  effective_date: z.string().max(10).nullable(),
  confidence: z.string().max(10),
  quote_status: z.string().max(20),
  edited_by_analyst: z.boolean(),
});

const ExportTeam = z.object({
  team: z.string().max(40),
  impact: z.string().max(10),
  one_time_hours: z.number(),
  ongoing_hours: z.number(),
  one_time_positions: z.number(),
  ongoing_positions: z.number(),
  by_class: z.array(z.object({ classification: z.string().max(40), one_time_hours: z.number(), ongoing_hours: z.number() })).max(20),
});

export const ExportSchema = z.object({
  export_version: z.string().max(10),
  kind: z.enum(["full", "drivers_only"]),
  generated_at: z.string().max(40),
  notice: z.string().max(200).optional(),
  tool: z.object({ prompt_version: z.string().max(40), taxonomy_version: z.string().max(10) }),
  bill: z.object({ id: z.string().max(60), label: z.string().max(120), version: z.string().max(200).nullable(), url: z.string().max(300).nullable() }),
  drivers: z.array(ExportDriver).max(200),
  score: z
    .object({ rubric_version: z.string().max(20), hours_per_position: z.number(), teams: z.array(ExportTeam).max(10) })
    .nullable(),
});
export type ExportFile = z.infer<typeof ExportSchema>;

export function buildExport(
  bill: BillMeta,
  drivers: ReviewedDriver[],
  result: ScoreResult | null,
  kind: "full" | "drivers_only",
  now: Date = new Date(),
): ExportFile {
  return {
    export_version: EXPORT_VERSION,
    kind,
    generated_at: now.toISOString(),
    notice: kind === "full" ? INTERNAL_MARK : undefined,
    tool: { prompt_version: PROMPT_VERSION, taxonomy_version: TAXONOMY_VERSION },
    bill,
    drivers: drivers.map((d) => ({
      code: d.code,
      summary: d.summary,
      section: d.section,
      quote: d.quote,
      frequency: d.frequency,
      effective_date: d.effective_date,
      confidence: d.confidence,
      quote_status: d.quoteStatus,
      edited_by_analyst: d.editedByAnalyst,
    })),
    score:
      kind === "full" && result
        ? {
            rubric_version: result.rubricVersion,
            hours_per_position: result.hoursPerPosition,
            teams: result.teams.map((t) => ({
              team: t.team,
              impact: t.impact,
              one_time_hours: t.oneTimeHours,
              ongoing_hours: t.ongoingHours,
              one_time_positions: t.oneTimePositions,
              ongoing_positions: t.ongoingPositions,
              by_class: t.byClass.map((c) => ({ classification: c.classification, one_time_hours: c.oneTimeHours, ongoing_hours: c.ongoingHours })),
            })),
          }
        : null,
  };
}

/** Markdown cells: escape pipes and flatten newlines so model text cannot break the table. */
const cell = (s: string | null | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

export function toMarkdown(e: ExportFile): string {
  const out: string[] = [];
  out.push(`# IT impact worksheet — ${cell(e.bill.label)}`);
  out.push("");
  if (e.notice) out.push(`> ${e.notice}`, "");
  out.push(`- Bill version: ${cell(e.bill.version) || "unknown"}`);
  if (e.bill.url) out.push(`- Source: ${e.bill.url}`);
  out.push(`- Generated: ${e.generated_at.slice(0, 10)} (prompt ${e.tool.prompt_version}, taxonomy v${e.tool.taxonomy_version}${e.score ? `, rubric ${e.score.rubric_version}` : ""})`);
  out.push("- Status: DRAFT for analyst review. Drivers were extracted with AI help and checked against the bill text.");
  out.push("");

  if (e.score) {
    out.push("## Impact by team", "");
    out.push(`| Team | Impact | One-time hours | Ongoing hours/yr | One-time positions | Ongoing positions |`);
    out.push(`| --- | --- | ---: | ---: | ---: | ---: |`);
    for (const t of e.score.teams) {
      const label = TEAM_LABELS[t.team as keyof typeof TEAM_LABELS] ?? t.team;
      out.push(`| ${label} | ${t.impact} | ${t.one_time_hours} | ${t.ongoing_hours} | ${t.one_time_positions} | ${t.ongoing_positions} |`);
    }
    out.push("", `Positions use ${e.score.hours_per_position} hours per position.`, "");
    out.push("## By classification", "");
    out.push(`| Team | Classification | One-time hours | Ongoing hours/yr |`);
    out.push(`| --- | --- | ---: | ---: |`);
    for (const t of e.score.teams) {
      for (const c of t.by_class) {
        const label = TEAM_LABELS[t.team as keyof typeof TEAM_LABELS] ?? t.team;
        out.push(`| ${label} | ${c.classification} | ${c.one_time_hours} | ${c.ongoing_hours} |`);
      }
    }
    out.push("");
  }

  out.push("## Workload drivers", "");
  out.push(`| Driver | Section | What the bill requires | Quote check | Confidence | Analyst edit |`);
  out.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const d of e.drivers) {
    out.push(`| ${cell(driverLabel(d.code))} | ${cell(d.section)} | ${cell(d.summary)} | ${d.quote_status} | ${d.confidence} | ${d.edited_by_analyst ? "yes" : ""} |`);
  }
  out.push("");
  return out.join("\n");
}

export function parseExport(text: string): { ok: true; file: ExportFile } | { ok: false; error: string } {
  if (text.length > 2_000_000) return { ok: false, error: "That file is too large to be an export." };
  try {
    const r = ExportSchema.safeParse(safeJsonParse(text));
    if (!r.success) return { ok: false, error: "That file is not an export from this tool." };
    return { ok: true, file: r.data };
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
}

export interface Comparison {
  added: ExportFile["drivers"];
  removed: ExportFile["drivers"];
  unchanged: number;
  teamDeltas: { team: string; oneTime: number; ongoing: number }[] | null;
}

const key = (d: { code: string; section: string }) => `${d.code}|${d.section.toLowerCase().replace(/\s+/g, " ").trim()}`;

/** FR-9: what changed between an earlier export and the current one. */
export function compareExports(previous: ExportFile, current: ExportFile): Comparison {
  const prevKeys = new Map(previous.drivers.map((d) => [key(d), d]));
  const curKeys = new Map(current.drivers.map((d) => [key(d), d]));
  const added = current.drivers.filter((d) => !prevKeys.has(key(d)));
  const removed = previous.drivers.filter((d) => !curKeys.has(key(d)));
  const unchanged = current.drivers.length - added.length;
  let teamDeltas: Comparison["teamDeltas"] = null;
  if (previous.score && current.score) {
    teamDeltas = TEAMS.map((team) => {
      const p = previous.score!.teams.find((t) => t.team === team);
      const c = current.score!.teams.find((t) => t.team === team);
      return {
        team,
        oneTime: (c?.one_time_hours ?? 0) - (p?.one_time_hours ?? 0),
        ongoing: (c?.ongoing_hours ?? 0) - (p?.ongoing_hours ?? 0),
      };
    });
  }
  return { added, removed, unchanged, teamDeltas };
}
