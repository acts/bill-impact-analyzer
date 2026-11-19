import "server-only";

/**
 * S-2, first layer: a small per-IP limiter inside each server instance.
 * It is best-effort (instances don't share memory). The second layer is a Vercel Firewall
 * rate-limit rule on /api/bill — see docs/DEPLOYMENT.md.
 */

const WINDOW_MS = 60_000;
const LIMIT = 20;
const MAX_TRACKED = 5_000;
const hits = new Map<string, number[]>();

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip") || "unknown";
}

export function allow(key: string, now: number = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_TRACKED) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return true;
}

export function _resetForTests() {
  hits.clear();
}
