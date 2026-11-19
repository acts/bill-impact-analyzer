/**
 * California bill identifiers.
 *
 * leginfo's internal id is: <startYear><endYear><sessionType><measureType><number>
 *   e.g. 202520260AB1 = 2025-26 regular session (0), Assembly Bill 1.
 *
 * Security (S-1): the server only ever accepts something that parses into this
 * shape. URLs are parsed for their bill_id parameter, never fetched as given.
 */

export const MEASURE_TYPES = [
  "AB", "SB", "ACA", "SCA", "AJR", "SJR", "ACR", "SCR", "HR", "SR",
] as const;
export type MeasureType = (typeof MEASURE_TYPES)[number];

export interface BillId {
  startYear: number;
  endYear: number;
  sessionType: number; // 0 = regular session, 1..9 = extraordinary sessions
  measureType: MeasureType;
  number: number;
}

const CANONICAL = /^(\d{4})(\d{4})(\d)(AB|SB|ACA|SCA|AJR|SJR|ACR|SCR|HR|SR)(\d{1,5})$/;
const SHORTHAND = /^(AB|SB|ACA|SCA|AJR|SJR|ACR|SCR|HR|SR)\s*-?\s*(\d{1,5})(?:\s*[,(]?\s*(\d{4})(?:\s*[-–]\s*(\d{2,4}))?\s*\)?)?$/i;

const MIN_YEAR = 1999;
const MAX_YEAR = 2099;

/** Regular sessions start in odd years (2025-26, 2027-28...). */
export function currentSessionStart(now: Date = new Date()): number {
  const y = now.getUTCFullYear();
  return y % 2 === 1 ? y : y - 1;
}

function valid(id: BillId): boolean {
  return (
    id.startYear >= MIN_YEAR &&
    id.startYear <= MAX_YEAR &&
    id.startYear % 2 === 1 &&
    id.endYear === id.startYear + 1 &&
    id.number >= 1 &&
    id.number <= 99999
  );
}

/**
 * Parse anything a user might paste: a leginfo URL, the canonical id,
 * or shorthand like "AB 123", "SB-45 2025", "AB123 (2025-26)".
 * Returns null for anything else.
 */
export function parseBillId(input: string, now: Date = new Date()): BillId | null {
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 500) return null;

  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.hostname !== "leginfo.legislature.ca.gov") return null;
    const param = url.searchParams.get("bill_id");
    if (!param) return null;
    candidate = param;
  }

  const upper = candidate.toUpperCase();
  const c = CANONICAL.exec(upper);
  if (c) {
    const id: BillId = {
      startYear: Number(c[1]),
      endYear: Number(c[2]),
      sessionType: Number(c[3]),
      measureType: c[4] as MeasureType,
      number: Number(c[5]),
    };
    return valid(id) ? id : null;
  }

  const s = SHORTHAND.exec(candidate);
  if (s) {
    let start = s[3] ? Number(s[3]) : currentSessionStart(now);
    if (start % 2 === 0) start -= 1; // "AB 5 2026" means the 2025-26 session
    const id: BillId = {
      startYear: start,
      endYear: start + 1,
      sessionType: 0,
      measureType: s[1].toUpperCase() as MeasureType,
      number: Number(s[2]),
    };
    return valid(id) ? id : null;
  }
  return null;
}

export function toCanonical(id: BillId): string {
  return `${id.startYear}${id.endYear}${id.sessionType}${id.measureType}${id.number}`;
}

export function toLabel(id: BillId): string {
  const ext = id.sessionType === 0 ? "" : ` (extraordinary session ${id.sessionType})`;
  return `${id.measureType} ${id.number}, ${id.startYear}–${String(id.endYear).slice(2)}${ext}`;
}

export const LEGINFO_ORIGIN = "https://leginfo.legislature.ca.gov";

/** The only URLs the server will ever request. Built from a validated id, never from user text. */
export function leginfoUrls(id: BillId) {
  const q = `bill_id=${toCanonical(id)}`;
  return {
    text: `${LEGINFO_ORIGIN}/faces/billTextClient.xhtml?${q}`,
    status: `${LEGINFO_ORIGIN}/faces/billStatusClient.xhtml?${q}`,
    analysis: `${LEGINFO_ORIGIN}/faces/billAnalysisClient.xhtml?${q}`,
    history: `${LEGINFO_ORIGIN}/faces/billHistoryClient.xhtml?${q}`,
  };
}
