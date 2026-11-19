import { NextResponse, type NextRequest } from "next/server";
import { leginfoUrls, parseBillId, toCanonical, toLabel } from "@/lib/billId";
import { htmlToBill } from "@/lib/billText";
import { fetchLeginfoHtml, LeginfoError } from "@/lib/server/leginfo";
import { allow, clientKey } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Response is public bill data only, so it is safe to cache at the edge (S-2). */
const CACHE = "public, s-maxage=1800, stale-while-revalidate=3600";

function err(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  if (!allow(clientKey(req.headers))) {
    return err(429, "rate_limited", "Too many requests. Wait a minute and try again.");
  }
  const raw = req.nextUrl.searchParams.get("id") ?? "";
  // S-1: only a bill id is accepted. A URL or anything else is rejected before any fetch.
  if (raw.length > 40 || !/^[0-9A-Za-z]+$/.test(raw)) {
    return err(400, "invalid_id", "That doesn't look like a California bill ID.");
  }
  const id = parseBillId(raw);
  if (!id || toCanonical(id) !== raw.toUpperCase()) {
    return err(400, "invalid_id", "That doesn't look like a California bill ID.");
  }

  const urls = leginfoUrls(id);
  try {
    const html = await fetchLeginfoHtml(urls.text);
    const bill = htmlToBill(html);
    if (bill.text.length < 200) {
      return err(404, "not_found", "No bill text found for that ID this session. Check the number, or paste the text yourself.");
    }
    return NextResponse.json(
      {
        id: toCanonical(id),
        label: toLabel(id),
        title: bill.title,
        versionLabel: bill.versionLabel,
        structured: bill.structured,
        text: bill.text,
        links: urls,
      },
      { headers: { "cache-control": CACHE } },
    );
  } catch (e) {
    if (e instanceof LeginfoError) {
      const status = e.code === "not_found" ? 404 : e.code === "timeout" ? 504 : 502;
      return err(status, e.code, `${e.message} You can paste the bill text yourself instead.`);
    }
    return err(502, "upstream", "Couldn't load the bill. You can paste the bill text yourself instead.");
  }
}
