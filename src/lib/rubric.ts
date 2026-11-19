import { z } from "zod";
import { CONFIDENCES, DRIVER_CODES, FREQUENCIES, TEAMS } from "./taxonomy";
import { safeJsonParse } from "./drivers";

/**
 * The rubric is the analyst's private file (S-5). It is read with the File API, validated here,
 * held in React state only, and never written to storage or sent over the network.
 */

export const CLASSIFICATIONS = [
  "IT Technician",
  "IT Associate",
  "IT Specialist I",
  "IT Specialist II",
  "IT Specialist III",
  "IT Supervisor I",
  "IT Supervisor II",
  "IT Manager I",
  "IT Manager II",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const MAX_RUBRIC_BYTES = 1_000_000;

const StaffLine = z
  .object({
    class: z.enum(CLASSIFICATIONS),
    hours: z.number().finite().min(0).max(100_000),
  })
  .strict();

const TeamLines = z.array(StaffLine).max(20);

const teamShape = Object.fromEntries(TEAMS.map((t) => [t, TeamLines.optional()])) as {
  [K in (typeof TEAMS)[number]]: z.ZodOptional<typeof TeamLines>;
};

export const RuleSchema = z
  .object({
    code: z.enum(DRIVER_CODES),
    when: z
      .object({
        frequency: z.array(z.enum(FREQUENCIES)).min(1).optional(),
        confidence: z.array(z.enum(CONFIDENCES)).min(1).optional(),
      })
      .strict()
      .optional(),
    teams: z.object(teamShape).strict(),
    /** true = the hours recur every year (ongoing); false = one-time implementation work */
    recurring: z.boolean().default(false),
    note: z.string().max(500).optional(),
  })
  .strict();

export const RubricSchema = z
  .object({
    rubric_version: z.string().min(1).max(20),
    name: z.string().max(120).optional(),
    hours_per_position: z.number().finite().min(1).max(5000),
    rules: z.array(RuleSchema).min(1).max(500),
  })
  .strict();

export type Rule = z.infer<typeof RuleSchema>;
export type Rubric = z.infer<typeof RubricSchema>;

export type RubricResult = { ok: true; rubric: Rubric } | { ok: false; errors: string[] };

export function parseRubric(text: string): RubricResult {
  if (new TextEncoder().encode(text).length > MAX_RUBRIC_BYTES) {
    return { ok: false, errors: ["The rubric file is larger than 1 MB."] };
  }
  let data: unknown;
  try {
    data = safeJsonParse(text);
  } catch (e) {
    return { ok: false, errors: [`The rubric is not valid JSON: ${(e as Error).message}`] };
  }
  const r = RubricSchema.safeParse(data);
  if (!r.success) {
    return {
      ok: false,
      errors: r.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(top level)"}: ${i.message}`),
    };
  }
  return { ok: true, rubric: r.data };
}
