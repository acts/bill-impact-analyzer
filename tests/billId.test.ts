import { describe, expect, it } from "vitest";
import { leginfoUrls, parseBillId, toCanonical, toLabel } from "@/lib/billId";

const now = new Date("2026-11-19T00:00:00Z");

describe("parseBillId", () => {
  it("parses canonical ids", () => {
    const id = parseBillId("202520260AB1", now)!;
    expect(toCanonical(id)).toBe("202520260AB1");
    expect(toLabel(id)).toBe("AB 1, 2025–26");
  });
  it("parses leginfo links by their bill_id parameter only", () => {
    const id = parseBillId("https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB45", now)!;
    expect(toCanonical(id)).toBe("202520260SB45");
  });
  it("rejects links on any other host", () => {
    expect(parseBillId("https://evil.example.com/faces/x?bill_id=202520260AB1", now)).toBeNull();
    expect(parseBillId("https://leginfo.legislature.ca.gov.evil.com/?bill_id=202520260AB1", now)).toBeNull();
  });
  it("parses shorthand, defaulting to the current session", () => {
    expect(toCanonical(parseBillId("ab 123", now)!)).toBe("202520260AB123");
    expect(toCanonical(parseBillId("SB-45 2027", now)!)).toBe("202720280SB45");
    expect(toCanonical(parseBillId("AB 5 2026", now)!)).toBe("202520260AB5");
    expect(toCanonical(parseBillId("AB123 (2025-26)", now)!)).toBe("202520260AB123");
  });
  it("rejects malformed and hostile input", () => {
    for (const bad of ["", "AB", "XY 12", "202620270AB1", "202520270AB1", "AB 0", "AB 123456", "../../etc/passwd", "AB 1; rm -rf", "http://169.254.169.254/latest"]) {
      expect(parseBillId(bad, now), bad).toBeNull();
    }
  });
  it("builds URLs only on the Legislature's host", () => {
    const urls = leginfoUrls(parseBillId("AB 1", now)!);
    for (const u of Object.values(urls)) expect(new URL(u).host).toBe("leginfo.legislature.ca.gov");
  });
});
