/*
 * Recognises a business inside an AI answer. Pure functions (client + server).
 * Ported from Ai Ads' lib/mentions.ts; the Dutch-only word lists are replaced by international ones.
 */
import type { Mention } from "@/lib/types";

export function normalize(s: string): string {
  return ` ${s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/* Connector words and legal forms in many countries. */
const FILLER = new Set("and the de het en und et y e of la le il el los las der die das co company inc llc ltd limited plc corp bv b v vof gmbh ag sa sl srl sas oy ab".split(" "));

export const stripFiller = (n: string) => n.trim().split(" ").filter((w) => w && !FILLER.has(w)).join(" ");

export function domainOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** True when two business names are essentially the same (same distinctive words). */
export function sameBusiness(a: string, b: string): boolean {
  const ta0 = stripFiller(normalize(a)).replace(/ /g, "");
  if (ta0.length >= 5 && ta0 === stripFiller(normalize(b)).replace(/ /g, "")) return true;
  const ta = new Set(stripFiller(normalize(a)).split(" ").filter(Boolean));
  const tb = new Set(stripFiller(normalize(b)).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return [...small].every((w) => big.has(w)) && (small.size >= 2 || (small.size === 1 && big.size === 1));
}

/**
 * Was the business named in the answer, only linked as a source, or absent?
 * Named = its name (or a close variant) is in the text, or one of the recommended businesses is it.
 */
export function detectMention(
  own: { name: string; domain: string; aliases?: string[] },
  answer: { text: string; sources: string[]; businesses: { name: string; website?: string }[] }
): { mention: Mention; position?: number } {
  const idx = answer.businesses.findIndex((b) => sameBusiness(b.name, own.name) || (own.domain && domainOf(b.website) === own.domain) || (own.aliases || []).some((a) => sameBusiness(b.name, a)));
  if (idx >= 0) return { mention: "named", position: idx + 1 };
  const text = normalize(answer.text);
  const variants = [own.name, ...(own.aliases || [])].map((v) => stripFiller(normalize(v))).filter((v) => v.replace(/ /g, "").length >= 4);
  if (variants.some((v) => text.includes(` ${v} `) || stripFiller(text).includes(` ${v} `))) return { mention: "named" };
  if (own.domain && (answer.text.toLowerCase().includes(own.domain) || answer.sources.some((s) => domainOf(s) === own.domain))) {
    // The domain in the visible text counts as a recommendation; only in the source list it's a weaker "linked".
    return answer.text.toLowerCase().includes(own.domain) ? { mention: "named" } : { mention: "linked" };
  }
  return { mention: "absent" };
}
