import "server-only";
import { LEGINFO_ORIGIN } from "@/lib/billId";

/**
 * S-1: the only outbound fetch in the app.
 * - URLs come from leginfoUrls(), built from a validated bill id, never from user text.
 * - Redirects are followed by hand, and only while they stay on the Legislature's host over https.
 * - Responses are capped at 5 MB and 10 seconds, and must be HTML.
 */

export const MAX_BYTES = 5 * 1024 * 1024;
export const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const ALLOWED_HOST = new URL(LEGINFO_ORIGIN).host;

export class LeginfoError extends Error {
  constructor(
    public code: "timeout" | "too_large" | "bad_redirect" | "upstream" | "not_html" | "not_found",
    message: string,
  ) {
    super(message);
  }
}

export function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.host === ALLOWED_HOST && u.username === "" && u.password === "";
  } catch {
    return false;
  }
}

async function readCapped(res: Response): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) throw new LeginfoError("too_large", "The bill page is unexpectedly large.");
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new LeginfoError("too_large", "The bill page is unexpectedly large.");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(buf);
}

export async function fetchLeginfoHtml(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let current = url;
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedUrl(current)) throw new LeginfoError("bad_redirect", "Refused to leave the Legislature's site.");
    let res: Response;
    try {
      res = await fetchImpl(current, {
        redirect: "manual",
        signal: deadline,
        headers: { accept: "text/html", "user-agent": "bill-impact-analyzer (personal research tool)" },
        cache: "no-store",
      });
    } catch (e) {
      if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
        throw new LeginfoError("timeout", "The Legislature's site did not answer in time.");
      }
      throw new LeginfoError("upstream", "Couldn't reach the Legislature's site.");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new LeginfoError("upstream", "The Legislature's site sent an empty redirect.");
      current = new URL(loc, current).toString();
      continue;
    }
    if (res.status === 404) throw new LeginfoError("not_found", "No bill with that ID.");
    if (!res.ok) throw new LeginfoError("upstream", `The Legislature's site answered ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new LeginfoError("not_html", "The Legislature's site returned something other than a web page.");
    }
    return readCapped(res);
  }
  throw new LeginfoError("bad_redirect", "Too many redirects.");
}
