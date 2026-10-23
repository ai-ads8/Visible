"use client";
import { useState } from "react";
import type { ScanView } from "@/lib/view";
import type { AgentsState, Blog, ReviewItem } from "@/lib/types";


export const stars = (n?: number) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function save(filename: string, data: Blob | string) {
  const blob = typeof data === "string" ? new Blob([data], { type: "text/plain;charset=utf-8" }) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [t, setT] = useState(label);
  return (
    <button className="btn quiet xs" type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setT("Copied"); } catch { setT("Copy failed"); }
      setTimeout(() => setT(label), 1600);
    }}>{t}</button>
  );
}

export function Code({ title, help, code, file }: { title: string; help: string; code: string; file: string }) {
  return (
    <div className="out">
      <div className="copyrow"><h3>{title}</h3><span style={{ display: "flex", gap: 8 }}><CopyButton text={code} /><button className="btn quiet xs" type="button" onClick={() => save(file, code)}>Download</button></span></div>
      <p className="small muted">{help}</p>
      <div className="codebox"><pre>{code}</pre></div>
    </div>
  );
}

/* ---------- generated files ---------- */
export function widgetHtml(name: string, language: string, g: NonNullable<AgentsState["geo"]>) {
  const items = g.reviews.slice(0, 6).map((r) => `  <figure style="margin:0;padding:16px;border:1px solid #e6e4ed;border-radius:12px;background:#fff">
    ${r.rating ? `<div style="color:#f5a623;letter-spacing:2px" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>\n    ` : ""}<blockquote style="margin:6px 0;font-size:15px;line-height:1.5">“${esc(r.quote)}”</blockquote>
    <figcaption style="font-size:13px;color:#77737f">${r.author ? esc(r.author) + ", " : ""}${r.url ? `<a href="${esc(r.url)}" rel="nofollow noopener" target="_blank">${esc(r.source)}</a>` : esc(r.source)}</figcaption>
  </figure>`).join("\n");
  const heading = language === "nl" ? "Wat klanten over ons zeggen" : language === "de" ? "Was unsere Kunden sagen" : "What our customers say";
  return `<!-- Reviews of ${esc(name)} -->
<section aria-label="Reviews" style="max-width:960px;margin:0 auto">
  <h2>${heading}</h2>
  ${g.rating ? `<p>${g.rating.value} / 5${g.rating.count ? ` (${g.rating.count} reviews)` : ""} on ${g.rating.url ? `<a href="${esc(g.rating.url)}" target="_blank" rel="noopener">${esc(g.rating.source)}</a>` : esc(g.rating.source)}</p>\n  ` : ""}<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
${items}
  </div>
</section>`;
}
export function schemaHtml(view: ScanView, g: NonNullable<AgentsState["geo"]>) {
  const p = view.profile, f = g.facts || {};
  const biz = { "@context": "https://schema.org", "@type": "LocalBusiness", name: p.name, url: p.website, description: f.description || undefined, telephone: f.phone || undefined, email: f.email || undefined, priceRange: f.priceRange || undefined, openingHours: f.openingHours || undefined, address: f.address || p.city ? { "@type": "PostalAddress", streetAddress: f.address || undefined, postalCode: f.postalCode || undefined, addressLocality: p.city || undefined, addressCountry: p.country } : undefined };
  const faq = g.faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) } : null;
  const tag = (o: object) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`;
  return [tag(biz), faq && tag(faq)].filter(Boolean).join("\n");
}
export function blogHtml(b: Blog) {
  return `<!-- Title: ${b.title}
     Meta description: ${b.meta}
     URL: /${b.slug} -->
<article>
<h1>${esc(b.title)}</h1>
<p>${esc(b.intro)}</p>
${b.sections.map((s) => `<h2>${esc(s.heading)}</h2>\n${s.paragraphs.map((x) => `<p>${esc(x)}</p>`).join("\n")}${s.bullets.length ? `\n<ul>\n${s.bullets.map((x) => `  <li>${esc(x)}</li>`).join("\n")}\n</ul>` : ""}`).join("\n")}
${b.faq.length ? `<h2>FAQ</h2>\n${b.faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n")}` : ""}
<p><strong>${esc(b.cta)}</strong></p>
</article>`;
}

/* ---------- post image ---------- */
export function drawPost(canvas: HTMLCanvasElement, post: { headline: string; quote: string }, review: ReviewItem | undefined, biz: { name: string; city: string; domain: string }) {
  const c = canvas.getContext("2d")!, W = 1080, pad = 96;
  canvas.width = W; canvas.height = W;
  const g = c.createLinearGradient(0, 0, W, W);
  g.addColorStop(0, "#1b1630"); g.addColorStop(1, "#2d1f6e");
  c.fillStyle = g; c.fillRect(0, 0, W, W);
  c.fillStyle = "rgba(139,118,255,.18)"; c.beginPath(); c.arc(930, 150, 260, 0, Math.PI * 2); c.fill();
  const display = getComputedStyle(document.body).getPropertyValue("--font-display") || "sans-serif";
  const body = getComputedStyle(document.body).getPropertyValue("--font-body") || "sans-serif";
  c.fillStyle = "#c9bfff"; c.font = `600 34px ${body}, sans-serif`; c.fillText(post.headline.toUpperCase().slice(0, 40), pad, 170);
  if (review?.rating) { c.fillStyle = "#ffc24b"; c.font = "60px sans-serif"; c.fillText(stars(review.rating), pad, 260); }
  c.fillStyle = "#ffffff";
  const wrap = (t: string, s: number) => { c.font = `700 ${s}px ${display}, sans-serif`; const lines: string[] = []; let line = ""; for (const w of `“${t}”`.split(/\s+/)) { const test = line ? line + " " + w : w; if (c.measureText(test).width > W - pad * 2 && line) { lines.push(line); line = w; } else line = test; } lines.push(line); return lines; };
  let size = 92, lines = wrap(post.quote, size);
  while (lines.length * size * 1.16 > 500 && size > 44) { size -= 4; lines = wrap(post.quote, size); }
  const top = 300 + Math.max(0, (520 - lines.length * size * 1.16) / 2) + size;
  lines.forEach((l, i) => c.fillText(l, pad, top + i * size * 1.16));
  c.fillStyle = "#cfcae6"; c.font = `500 32px ${body}, sans-serif`;
  c.fillText(`${review?.author || "A customer"}${review?.source ? ` · ${review.source}` : ""}`.slice(0, 60), pad, 880);
  c.fillStyle = "#ffffff"; c.font = `800 46px ${display}, sans-serif`; c.fillText(biz.name.slice(0, 32), pad, 970);
  c.fillStyle = "#c9bfff"; c.font = `500 30px ${body}, sans-serif`; c.fillText([biz.city, biz.domain].filter(Boolean).join("  ·  "), pad, 1015);
}

