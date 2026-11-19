/**
 * Driver taxonomy v1 — the public contract between the AI (part 1) and the rubric (part 2).
 * It is generic on purpose: it says what kind of IT work a bill creates, never what it costs.
 * Changing a code is a breaking change: bump TAXONOMY_VERSION and record it in docs/DECISIONS.md.
 */

export const TAXONOMY_VERSION = "1";

export const TEAMS = ["development", "project_management", "operations", "security"] as const;
export type Team = (typeof TEAMS)[number];

export const TEAM_LABELS: Record<Team, string> = {
  development: "Development",
  project_management: "Project Management",
  operations: "Operations",
  security: "Security",
};

export interface DriverDef {
  code: string;
  label: string;
  meaning: string;
  usualTeams: Team[];
}

export const DRIVERS: readonly DriverDef[] = [
  { code: "ELIG_RULE_CHANGE", label: "Eligibility or benefit rule change", meaning: "Changes eligibility, benefit amounts, or how benefits are calculated.", usualTeams: ["development", "operations"] },
  { code: "NEW_PROGRAM", label: "New program or pilot", meaning: "Creates a new program, pilot, or benefit that must be administered.", usualTeams: ["development", "project_management", "operations", "security"] },
  { code: "NEW_SYSTEM", label: "New or majorly changed IT system", meaning: "Requires a new IT system, or a major change to an existing one.", usualTeams: ["project_management", "development", "security", "operations"] },
  { code: "NEW_REPORT", label: "New report or data publication", meaning: "Requires a new report, dashboard, or data publication to the Legislature or the public.", usualTeams: ["development"] },
  { code: "NEW_DATA_COLLECTION", label: "New data collection", meaning: "Requires collecting new data elements from clients, counties, or providers.", usualTeams: ["development", "security"] },
  { code: "DATA_SHARING", label: "Data sharing or interface", meaning: "Requires exchanging data with another agency, county, or vendor.", usualTeams: ["development", "security", "operations"] },
  { code: "CLIENT_NOTICE", label: "Client notice or form", meaning: "Requires a new or changed notice, form, or letter sent to clients.", usualTeams: ["development"] },
  { code: "PII_HANDLING", label: "Personal data handling", meaning: "Changes how personal or confidential information is handled, retained, or disclosed.", usualTeams: ["security"] },
  { code: "ACCESS_CHANGE", label: "Access or user change", meaning: "Adds new user groups, roles, or external users of a system.", usualTeams: ["security", "operations"] },
  { code: "PROCUREMENT", label: "Procurement", meaning: "Requires buying software, services, or entering a contract.", usualTeams: ["project_management"] },
  { code: "AUTOMATION_REQ", label: "Automation requirement", meaning: "Requires automating a process that is manual today.", usualTeams: ["development", "project_management"] },
  { code: "RETENTION_AUDIT", label: "Retention, audit, or logging", meaning: "Adds a record-retention, audit, or logging requirement.", usualTeams: ["security", "operations"] },
  { code: "ACCESSIBILITY_LANG", label: "Accessibility or language access", meaning: "Adds an accessibility or language-access requirement.", usualTeams: ["development"] },
  { code: "DEADLINE", label: "Deadline or operative date", meaning: "Sets an operative date, implementation deadline, or sunset. A modifier: it raises urgency on other drivers.", usualTeams: [] },
  { code: "NO_IT_IMPACT", label: "No IT impact", meaning: "Use only when the bill creates no IT work at all.", usualTeams: [] },
] as const;

export const DRIVER_CODES = DRIVERS.map((d) => d.code) as [string, ...string[]];

export function driverLabel(code: string): string {
  return DRIVERS.find((d) => d.code === code)?.label ?? code;
}

export const FREQUENCIES = ["one_time", "annual", "semiannual", "quarterly", "monthly", "ongoing", "unknown"] as const;
export const CONFIDENCES = ["high", "medium", "low"] as const;
