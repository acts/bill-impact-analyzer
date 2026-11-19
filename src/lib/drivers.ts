import { z } from "zod";
import { CONFIDENCES, DRIVER_CODES, FREQUENCIES } from "./taxonomy";
import { normalizeForMatch } from "./billText";

/**
 * The AI's answer is untrusted (AI Engineering Standard §3, §5): it is parsed, validated
 * against this schema, and only ever rendered as text.
 */

const short = (max: number) => z.string().trim().max(max);

export const DriverSchema = z
  .object({
    code: z.enum(DRIVER_CODES),
    summary: short(400).min(1),
    section: short(200).default(""),
    quote: short(600).default(""),
    frequency: z.enum(FREQUENCIES).catch("unknown").default("unknown"),
    effective_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
      .catch(null)
      .default(null),
    confidence: z.enum(CONFIDENCES).catch("low").default("low"),
  })
  .strict();

export const AnswerSchema = z
  .object({
    taxonomy_version: z.string().max(10).optional(),
    prompt_version: z.string().max(40).optional(),
    bill: z
      .object({ id: short(60).optional(), version: z.union([short(200), z.null()]).optional() })
      .partial()
      .optional(),
    drivers: z.array(DriverSchema).min(1).max(100),
    not_found: z.array(z.string().max(40)).max(50).optional().default([]),
  })
  .strict();

export type Driver = z.infer<typeof DriverSchema>;
export type Answer = z.infer<typeof AnswerSchema>;

export type QuoteStatus = "verified" | "unverified" | "missing" | "no_bill_text";

export interface ReviewedDriver extends Driver {
  id: string;
  quoteStatus: QuoteStatus;
  /** set when the analyst added or changed this row (FR-8) */
  editedByAnalyst: boolean;
}

export const MAX_ANSWER_CHARS = 200_000;

/** Pull the JSON object out of a chat reply (tolerates ```json fences and chatter around it). */
export function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return body.slice(start, end + 1);
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** JSON.parse that refuses prototype-pollution keys anywhere in the tree. */
export function safeJsonParse(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`Key "${key}" is not allowed.`);
    return value;
  });
}

export type ParseResult =
  | { ok: true; answer: Answer }
  | { ok: false; errors: string[] };

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.length ? issue.path.join(".") : "(top level)";
  if (issue.code === "invalid_value" && issue.path.at(-1) === "code") {
    return `${path}: not one of the allowed driver codes`;
  }
  if (issue.code === "unrecognized_keys") {
    return `${path}: unexpected field(s) ${issue.keys.join(", ")}`;
  }
  return `${path}: ${issue.message}`;
}

export function parseAnswer(raw: string): ParseResult {
  if (raw.length > MAX_ANSWER_CHARS) return { ok: false, errors: ["The answer is too long to be a driver list."] };
  const json = extractJson(raw);
  if (!json) return { ok: false, errors: ["No JSON object found. Paste the AI's whole reply, starting at {."] };
  let data: unknown;
  try {
    data = safeJsonParse(json);
  } catch (e) {
    return { ok: false, errors: [`The JSON could not be read: ${(e as Error).message}`] };
  }
  const result = AnswerSchema.safeParse(data);
  if (!result.success) return { ok: false, errors: result.error.issues.slice(0, 10).map(describeIssue) };
  return { ok: true, answer: result.data };
}

export function verifyQuote(quote: string, billText: string | null): QuoteStatus {
  if (!billText) return "no_bill_text";
  const q = normalizeForMatch(quote);
  if (q.length < 8) return "missing";
  return normalizeForMatch(billText).includes(q) ? "verified" : "unverified";
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `d${Date.now().toString(36)}${counter}`;
}

export function reviewDrivers(answer: Answer, billText: string | null): ReviewedDriver[] {
  return answer.drivers.map((d) => ({
    ...d,
    id: newId(),
    quoteStatus: verifyQuote(d.quote, billText),
    editedByAnalyst: false,
  }));
}
