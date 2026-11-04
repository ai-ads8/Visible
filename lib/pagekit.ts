/*
 * Pages that win: the pure parts, used in the browser (editor, preview) and on the server (publishing, tests).
 * A page may hold [[add: …]] placeholders for facts we couldn't find on the website (a price, a service area).
 * It can only be approved or published once every placeholder has been filled in by the owner, so nothing
 * guessed or half-finished goes online.
 */
import type { WinPage } from "./types";

export const PLACEHOLDER = /\[\[([^\]]{1,200})\]\]/g;

const texts = (p: Pick<WinPage, "title" | "meta" | "answer" | "sections" | "faq" | "cta">) => [
  p.title,
  p.meta,
  p.answer,
  p.cta,
  ...p.sections.flatMap((s) => [s.heading, s.text]),
  ...p.faq.flatMap((f) => [f.q, f.a]),
];

/** What the owner still has to fill in, in their words ("your starting price"). */
export function openPlaceholders(p: Pick<WinPage, "title" | "meta" | "answer" | "sections" | "faq" | "cta">): string[] {
  const out: string[] = [];
  for (const t of texts(p)) for (const m of (t || "").matchAll(PLACEHOLDER)) out.push(m[1].replace(/^\s*add\s*:\s*/i, "").trim());
  return [...new Set(out)];
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70)
      .replace(/-+$/, "") || "page"
  );
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const paras = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Turns a paragraph into HTML: lines starting with "- " become a list. */
function block(t: string): string {
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines.every((l) => /^[-•]\s+/.test(l))) return `<ul>\n${lines.map((l) => `  <li>${esc(l.replace(/^[-•]\s+/, ""))}</li>`).join("\n")}\n</ul>`;
  return `<p>${lines.map(esc).join("<br>")}</p>`;
}

/**
 * The page body as clean HTML for a CMS (the title goes in the CMS's own title field). The direct answer comes
 * first, then the sections, the FAQ (with FAQPage structured data) and the call to action.
 */
export function pageHtml(p: WinPage): string {
  const out: string[] = [];
  out.push(`<p><strong>${esc(p.answer)}</strong></p>`);
  for (const s of p.sections) {
    if (s.heading) out.push(`<h2>${esc(s.heading)}</h2>`);
    for (const t of paras(s.text)) out.push(block(t));
  }
  if (p.faq.length) {
    out.push(`<h2>${esc(p.faqTitle || "FAQ")}</h2>`);
    for (const f of p.faq) out.push(`<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`);
    const ld = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    };
    out.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }
  if (p.cta) out.push(`<p><strong>${esc(p.cta)}</strong></p>`);
  return out.join("\n\n");
}

/** Plain-text word count of the readable parts. */
export const wordCount = (p: WinPage) => texts(p).join(" ").split(/\s+/).filter(Boolean).length;
