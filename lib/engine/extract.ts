import "server-only";
import * as cheerio from "cheerio";

/*
 * HTML → page facts. A trimmed, international version of Ai Ads' lib/scanner/extract.ts: the language-neutral
 * structure (JSON-LD, meta, headings, links, FAQ-style questions, reviews) is kept; Dutch-only heuristics are gone.
 */

export interface LinkInfo {
  href: string;
  text: string;
  internal: boolean;
}

export interface PageData {
  url: string;
  status: number;
  kind: PageKind;
  title: string;
  metaDescription: string;
  metaRobots: string;
  canonical: string;
  lang: string;
  hasViewport: boolean;
  ogSiteName: string;
  ogImage: string;
  h1: string[];
  headings: string[];
  text: string;
  words: number;
  jsonld: Record<string, unknown>[];
  links: LinkInfo[];
  images: { src: string; alt: string }[];
  questions: string[];
  hasForm: boolean;
  icon?: string;
}

export type PageKind = "home" | "contact" | "about" | "services" | "prices" | "faq" | "reviews" | "booking" | "other";

/* Multilingual on purpose: Visible is international, so the common words of EN/NL/DE/FR/ES/IT/PT are recognised. */
export function classifyUrl(url: string, text = ""): PageKind {
  const s = (url + " " + text).toLowerCase();
  let p = url.toLowerCase();
  try {
    p = new URL(url).pathname.toLowerCase();
  } catch {}
  if (p === "/" || p === "" || /\/(index|home)(\.\w+)?$/.test(p)) return "home";
  if (/contact|kontakt|contatt|contacto|find-us|location|directions/.test(s)) return "contact";
  if (/faq|frequently|questions|veelgestelde|fragen|preguntas|domande/.test(s)) return "faq";
  if (/pric|rates|tarif|prijs|preise|precio|prezzi|cost/.test(s)) return "prices";
  if (/about|over-ons|ueber-uns|uber-uns|qui-sommes|sobre|chi-siamo|our-story|team/.test(s)) return "about";
  if (/review|testimonial|recensie|bewertung|avis|opinion/.test(s)) return "reviews";
  if (/book|reserv|appointment|termin|afspraak|quote|offerte|cita/.test(s)) return "booking";
  if (/service|treatment|what-we-do|leistung|dienst|servicios|servizi|menu|products/.test(s)) return "services";
  return "other";
}

function flattenJsonLd(node: unknown, out: Record<string, unknown>[]) {
  if (!node) return;
  if (Array.isArray(node)) return node.forEach((n) => flattenJsonLd(n, out));
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj["@graph"]) flattenJsonLd(obj["@graph"], out);
    if (obj["@type"]) out.push(obj);
  }
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function parsePage(url: string, status: number, html: string): PageData {
  const $ = cheerio.load(html);
  const base = new URL(url);

  const jsonld: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      flattenJsonLd(JSON.parse(raw), jsonld);
    } catch {
      try {
        flattenJsonLd(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")), jsonld);
      } catch {}
    }
  });

  const abs = (u?: string) => {
    if (!u) return undefined;
    try {
      const x = new URL(u.trim(), base);
      return /^https?:$/.test(x.protocol) ? x.toString() : undefined;
    } catch {
      return undefined;
    }
  };

  const images: { src: string; alt: string }[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    const w = parseInt($(el).attr("width") || "0", 10);
    if (!src || /pixel|spacer|1x1|tracking/i.test(src) || (w > 0 && w < 24)) return;
    images.push({ src, alt: ($(el).attr("alt") || "").trim() });
  });

  const links: LinkInfo[] = [];
  $("a[href]").each((_, el) => {
    const hrefRaw = ($(el).attr("href") || "").trim();
    if (!hrefRaw || hrefRaw.startsWith("#") || hrefRaw.startsWith("javascript:")) return;
    const text = clean($(el).text()).slice(0, 120) || ($(el).attr("aria-label") || "").trim();
    if (/^(tel|mailto|whatsapp|sms):/i.test(hrefRaw)) return void links.push({ href: hrefRaw, text, internal: false });
    try {
      const a = new URL(hrefRaw, base);
      a.hash = "";
      links.push({ href: a.toString(), text, internal: a.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "") });
    } catch {}
  });

  const qSet = new Set<string>();
  $("h1,h2,h3,h4,h5,h6,summary,button,dt,strong,b,p,span,a,label,li").each((_, el) => {
    if (qSet.size >= 60) return false;
    const own = clean($(el).clone().children("div,p,ul,ol,section,details").remove().end().text());
    if (own.length >= 8 && own.length <= 160 && /\?$/.test(own) && !/[.!]\s/.test(own.slice(0, -1))) qSet.add(own);
  });

  const title = clean($("title").first().text());
  const h1 = $("h1").map((_, el) => clean($(el).text())).get().filter(Boolean);
  const headings = $("h1,h2,h3").map((_, el) => clean($(el).text())).get().filter((t) => t && t.length < 160);
  const hasForm = $("form").length > 0;
  const icon = abs($('link[rel="apple-touch-icon"]').attr("href") || $('link[rel~="icon"]').attr("href"));

  $("script,style,noscript,svg,template,iframe").remove();
  $("br").replaceWith("\n");
  $("a,span,button,label,strong,em,b,i,small").each((_, el) => void $(el).append(" "));
  $("p,div,li,h1,h2,h3,h4,h5,h6,section,article,header,footer,tr,dt,dd,address,td").each((_, el) => void $(el).append("\n"));
  const text = ($("body").text() || $.root().text()).replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, 120_000);
  const words = text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length;

  return {
    url,
    status,
    kind: classifyUrl(url, title),
    title,
    metaDescription: ($('meta[name="description"]').attr("content") || "").trim(),
    metaRobots: ($('meta[name="robots"]').attr("content") || "").toLowerCase(),
    canonical: ($('link[rel="canonical"]').attr("href") || "").trim(),
    lang: ($("html").attr("lang") || "").toLowerCase(),
    hasViewport: $('meta[name="viewport"]').length > 0,
    ogSiteName: ($('meta[property="og:site_name"]').attr("content") || "").trim(),
    ogImage: abs($('meta[property="og:image"]').attr("content")) || "",
    h1,
    headings,
    text,
    words,
    jsonld,
    links,
    images,
    questions: [...qSet],
    hasForm,
    icon,
  };
}
