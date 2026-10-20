import "server-only";
import { safeFetch, ScanError } from "./fetch";
import { classifyUrl, parsePage, type PageData } from "./extract";

/*
 * Reads the start page, the homepage and up to 8 of the most useful internal pages, plus robots.txt, sitemap.xml and
 * llms.txt. Based on Ai Ads' lib/scanner/crawl.ts; the social-profile scraping is left out on purpose (it relied on
 * unofficial endpoints and spoofed crawler user agents).
 */

const MAX_PAGES = 10;
const PRIORITY: Record<string, number> = { contact: 10, services: 9, faq: 8, prices: 8, about: 7, reviews: 6, booking: 6, other: 0, home: 0 };
const SKIP_RE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)(\?|$)|\/(wp-admin|wp-login|cart|checkout|account|login|privacy|cookie|terms|legal|disclaimer|tag|author|feed)\b|\?(add-to-cart|replytocom)=/i;

export interface CrawlResult {
  startUrl: string;
  pages: PageData[];
  robotsTxt: string | null;
  sitemapFound: boolean;
  llmsTxt: boolean;
  https: boolean;
  failed: number;
}

const canonicalKey = (u: string) => {
  try {
    const url = new URL(u);
    return (url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return u;
  }
};

async function fetchPage(url: string): Promise<PageData | null> {
  try {
    const res = await safeFetch(url);
    if (!/html|xml/i.test(res.contentType) && !res.body.trim().startsWith("<")) return null;
    return parsePage(res.url, res.status, res.body);
  } catch {
    return null;
  }
}

async function fetchText(url: string) {
  try {
    const res = await safeFetch(url, { accept: "text/plain,application/xml,text/xml,*/*", maxBytes: 400_000 });
    return res.status < 400 && !/<html/i.test(res.body) ? res.body : null;
  } catch {
    return null;
  }
}

export async function crawl(start: URL): Promise<CrawlResult> {
  const first = await safeFetch(start);
  if (first.status >= 400) {
    throw new ScanError(
      "status " + first.status,
      first.status === 403 || first.status === 429 ? "Your website blocks automated visitors, so we can't read it. Try another page of your site." : `Your website returned an error (${first.status}). Check the address.`
    );
  }
  const startPage = parsePage(first.url, first.status, first.body);
  const origin = new URL(first.url).origin;
  const pages: PageData[] = [startPage];
  const seen = new Set([canonicalKey(first.url)]);
  const candidates = new Map<string, number>();
  const add = (p: PageData) => {
    for (const l of p.links) {
      if (!l.internal || SKIP_RE.test(l.href) || seen.has(canonicalKey(l.href))) continue;
      const kind = classifyUrl(l.href, l.text);
      if (kind === "home") continue;
      const depth = new URL(l.href).pathname.split("/").filter(Boolean).length;
      if (kind === "other" && depth > 2) continue;
      candidates.set(l.href, Math.max((PRIORITY[kind] ?? 0) - depth * 0.1, candidates.get(l.href) ?? -99));
    }
  };
  add(startPage);

  const sitemapP = fetchText(origin + "/sitemap.xml");
  if (!seen.has(canonicalKey(origin + "/"))) {
    const root = await fetchPage(origin + "/");
    if (root && root.status < 400) {
      seen.add(canonicalKey(root.url));
      pages.push(root);
      add(root);
    }
  }

  // Best page per kind first, then fill up.
  const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
  const byKind = new Map<string, string>();
  for (const u of sorted) if (!byKind.has(classifyUrl(u))) byKind.set(classifyUrl(u), u);
  const queue = [...new Set([...byKind.values(), ...sorted])].filter((u) => !seen.has(canonicalKey(u))).slice(0, MAX_PAGES - pages.length);

  let failed = 0;
  const [results, robotsTxt, llms, sitemap] = await Promise.all([
    Promise.all(queue.map((u) => fetchPage(u))),
    fetchText(origin + "/robots.txt"),
    fetchText(origin + "/llms.txt"),
    sitemapP,
  ]);
  for (const p of results) {
    if (!p || p.status >= 400) {
      failed++;
      continue;
    }
    if (seen.has(canonicalKey(p.url))) continue;
    seen.add(canonicalKey(p.url));
    pages.push(p);
  }

  return {
    startUrl: first.url,
    pages,
    robotsTxt,
    sitemapFound: !!(sitemap && /<(urlset|sitemapindex)/i.test(sitemap)) || /^\s*sitemap:/im.test(robotsTxt || ""),
    llmsTxt: !!(llms && llms.trim().length > 20),
    https: first.url.startsWith("https:"),
    failed,
  };
}
