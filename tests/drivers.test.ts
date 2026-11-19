import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAnswer, reviewDrivers, verifyQuote } from "@/lib/drivers";
import { htmlToBill } from "@/lib/billText";

const billText = htmlToBill(readFileSync("tests/fixtures/bill.html", "utf8")).text;
const answer = readFileSync("tests/fixtures/answer.json", "utf8");

describe("parseAnswer (FR-4)", () => {
  it("accepts a valid answer, even wrapped in chat text and a code fence", () => {
    const r = parseAnswer("Sure! Here you go:\n```json\n" + answer + "\n```\nLet me know.");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answer.drivers).toHaveLength(4);
  });
  it("rejects malformed JSON", () => {
    const r = parseAnswer('{ "drivers": [ { "code": "NEW_REPORT", } ');
    expect(r.ok).toBe(false);
  });
  it("rejects unknown driver codes", () => {
    const r = parseAnswer(JSON.stringify({ drivers: [{ code: "HIRE_TEN_PEOPLE", summary: "x" }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/allowed driver codes/);
  });
  it("rejects extra fields (strict output contract)", () => {
    const r = parseAnswer(JSON.stringify({ drivers: [{ code: "NEW_REPORT", summary: "x", hours: 9000 }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/hours/);
  });
  it("rejects prototype-pollution keys", () => {
    const r = parseAnswer('{"drivers":[{"code":"NEW_REPORT","summary":"x"}],"__proto__":{"admin":true}}');
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
  it("rejects an empty driver list and oversized input", () => {
    expect(parseAnswer('{"drivers":[]}').ok).toBe(false);
    expect(parseAnswer("x".repeat(200_001)).ok).toBe(false);
  });
  it("keeps HTML in model text as inert text (rendered as text, never HTML)", () => {
    const r = parseAnswer(JSON.stringify({ drivers: [{ code: "NEW_REPORT", summary: "<img src=x onerror=alert(1)>" }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answer.drivers[0].summary).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("quote verification (FR-5)", () => {
  it("verifies real quotes regardless of case, spacing and quote style", () => {
    expect(verifyQuote("shall  REPORT annually to the Legislature", billText)).toBe("verified");
  });
  it("flags fabricated quotes", () => {
    expect(verifyQuote("shall build a new statewide case management system", billText)).toBe("unverified");
  });
  it("flags missing quotes and missing bill text", () => {
    expect(verifyQuote("", billText)).toBe("missing");
    expect(verifyQuote("shall report annually", null)).toBe("no_bill_text");
  });
  it("marks every fixture quote verified", () => {
    const r = parseAnswer(answer);
    if (!r.ok) throw new Error("fixture invalid");
    expect(reviewDrivers(r.answer, billText).map((d) => d.quoteStatus)).toEqual(["verified", "verified", "verified", "verified"]);
  });
});
