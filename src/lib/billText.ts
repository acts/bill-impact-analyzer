import { parse } from "node-html-parser";

/**
 * Turn a leginfo bill-text page into plain text (S-1: HTML never reaches the browser).
 *
 * The parser prefers the bill container (`#bill_all` / `#bill`) when present and
 * otherwise falls back to the whole body. It then trims to the span that starts at
 * the Legislative Counsel's Digest (or the enacting clause) so navigation text is
 * dropped. If the markers are missing it returns the cleaned body text, and the
 * UI tells the analyst to check it or paste the text instead.
 */

export interface ParsedBill {
  title: string | null;
  versionLabel: string | null;
  text: string;
  /** true when the digest/enacting-clause markers were found */
  structured: boolean;
}

const BLOCK_TAGS = new Set([
  "p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "table", "section", "article", "blockquote",
]);

const DIGEST = /LEGISLATIVE COUNSEL['’]S DIGEST/i;
const ENACT = /THE PEOPLE OF THE STATE OF CALIFORNIA DO ENACT AS FOLLOWS/i;
const VERSION = /\b(Introduced|Amended\s+in\s+(?:Assembly|Senate)|Enrolled|Chaptered\s+by\s+Secretary\s+of\s+State|Passed\s+the\s+(?:Assembly|Senate))\b[^\n]{0,60}?\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
}

type Node = ReturnType<typeof parse>;

function nodeToText(node: Node): string {
  const out: string[] = [];
  const walk = (n: Node | Node["childNodes"][number]) => {
    // text node
    if (n.nodeType === 3) {
      out.push((n as unknown as { rawText: string }).rawText);
      return;
    }
    const el = n as Node;
    const tag = (el as unknown as { rawTagName?: string }).rawTagName?.toLowerCase() ?? "";
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "nav" || tag === "header" || tag === "footer") return;
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push("\n");
    for (const c of el.childNodes) walk(c as Node);
    if (block) out.push("\n");
  };
  walk(node);
  return out.join("");
}

export function normalizeWhitespace(s: string): string {
  return decodeEntities(s)
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToBill(html: string): ParsedBill {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const container = root.querySelector("#bill_all") ?? root.querySelector("#bill") ?? root.querySelector("body") ?? root;
  const full = normalizeWhitespace(nodeToText(container as Node));

  const titleEl = root.querySelector("#bill_title") ?? root.querySelector("h1") ?? root.querySelector("title");
  let title = titleEl ? normalizeWhitespace(titleEl.text).slice(0, 300) : null;
  if (title === "") title = null;

  const versionMatch = VERSION.exec(full);
  const versionLabel = versionMatch ? versionMatch[0].replace(/\s+/g, " ").trim() : null;

  const d = full.search(DIGEST);
  const e = full.search(ENACT);
  const start = d >= 0 ? d : e;
  const text = start >= 0 ? full.slice(start) : full;

  return { title, versionLabel, text, structured: start >= 0 };
}

/** For quote matching: case-, quote-style- and whitespace-insensitive. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
