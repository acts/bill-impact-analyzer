import { describe, expect, it, beforeEach } from "vitest";
import { fetchLeginfoHtml, isAllowedUrl, LeginfoError, MAX_BYTES } from "@/lib/server/leginfo";
import { allow, _resetForTests } from "@/lib/server/rateLimit";

const OK = "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB1";

function fakeFetch(responses: Array<() => Response>) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("isAllowedUrl (S-1)", () => {
  it("allows only https on the Legislature's host", () => {
    expect(isAllowedUrl(OK)).toBe(true);
    expect(isAllowedUrl("http://leginfo.legislature.ca.gov/x")).toBe(false);
    expect(isAllowedUrl("https://leginfo.legislature.ca.gov.evil.com/x")).toBe(false);
    expect(isAllowedUrl("https://user:pw@leginfo.legislature.ca.gov/x")).toBe(false);
    expect(isAllowedUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
  });
});

describe("fetchLeginfoHtml (S-1)", () => {
  it("returns HTML from the allowed host", async () => {
    const { impl } = fakeFetch([() => new Response("<html>ok</html>", { headers: { "content-type": "text/html; charset=utf-8" } })]);
    expect(await fetchLeginfoHtml(OK, impl)).toBe("<html>ok</html>");
  });
  it("follows redirects on the same host", async () => {
    const { impl, calls } = fakeFetch([
      () => new Response(null, { status: 302, headers: { location: "/faces/other.xhtml" } }),
      () => new Response("<html>ok</html>", { headers: { "content-type": "text/html" } }),
    ]);
    await fetchLeginfoHtml(OK, impl);
    expect(calls[1]).toBe("https://leginfo.legislature.ca.gov/faces/other.xhtml");
  });
  it("refuses redirects to another host (SSRF)", async () => {
    const { impl, calls } = fakeFetch([() => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } })]);
    await expect(fetchLeginfoHtml(OK, impl)).rejects.toMatchObject({ code: "bad_redirect" });
    expect(calls).toHaveLength(1);
  });
  it("refuses a starting URL off the host", async () => {
    const { impl, calls } = fakeFetch([]);
    await expect(fetchLeginfoHtml("https://example.com/", impl)).rejects.toBeInstanceOf(LeginfoError);
    expect(calls).toHaveLength(0);
  });
  it("refuses non-HTML and oversized responses", async () => {
    const json = fakeFetch([() => new Response("{}", { headers: { "content-type": "application/json" } })]);
    await expect(fetchLeginfoHtml(OK, json.impl)).rejects.toMatchObject({ code: "not_html" });
    const big = fakeFetch([() => new Response("x".repeat(MAX_BYTES + 10), { headers: { "content-type": "text/html" } })]);
    await expect(fetchLeginfoHtml(OK, big.impl)).rejects.toMatchObject({ code: "too_large" });
  });
  it("stops after too many redirects", async () => {
    const loop = () => new Response(null, { status: 302, headers: { location: OK } });
    const { impl } = fakeFetch([loop, loop, loop, loop, loop]);
    await expect(fetchLeginfoHtml(OK, impl)).rejects.toMatchObject({ code: "bad_redirect" });
  });
});

describe("rate limit (S-2)", () => {
  beforeEach(() => _resetForTests());
  it("allows 20 requests a minute per client, then blocks", () => {
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) expect(allow("1.2.3.4", t + i)).toBe(true);
    expect(allow("1.2.3.4", t + 30)).toBe(false);
    expect(allow("5.6.7.8", t + 30)).toBe(true);
    expect(allow("1.2.3.4", t + 61_000)).toBe(true);
  });
});
