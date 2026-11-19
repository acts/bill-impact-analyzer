import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { htmlToBill } from "@/lib/billText";

const html = readFileSync("tests/fixtures/bill.html", "utf8");

describe("htmlToBill", () => {
  const bill = htmlToBill(html);
  it("finds the version label and title", () => {
    expect(bill.versionLabel).toBe("Amended in Assembly March 12, 2026");
    expect(bill.title).toContain("AB-999");
  });
  it("starts at the digest and drops navigation, scripts and styles", () => {
    expect(bill.structured).toBe(true);
    expect(bill.text.startsWith("LEGISLATIVE COUNSEL'S DIGEST")).toBe(true);
    expect(bill.text).not.toContain("should never appear");
    expect(bill.text).not.toContain("color:red");
    expect(bill.text).not.toContain("Copyright");
  });
  it("decodes entities", () => {
    expect(bill.text).toContain("each county & the Franchise Tax Board");
  });
  it("falls back to body text when markers are missing", () => {
    const b = htmlToBill("<html><body><p>Some page without a bill</p></body></html>");
    expect(b.structured).toBe(false);
    expect(b.text).toBe("Some page without a bill");
  });
});
