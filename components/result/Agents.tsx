"use client";
import { useEffect, useRef, useState } from "react";
import type { ScanView } from "@/lib/view";
import type { AgentsState, Blog, ReviewItem } from "@/lib/types";

import { AGENTS, ICON } from "../agentsMeta";

const stars = (n?: number) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function save(filename: string, data: Blob | string) {
  const blob = typeof data === "string" ? new Blob([data], { type: "text/plain;charset=utf-8" }) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [t, setT] = useState(label);
  return (
    <button className="btn quiet xs" type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setT("Copied"); } catch { setT("Copy failed"); }
      setTimeout(() => setT(label), 1600);
    }}>{t}</button>
  );
}

function Code({ title, help, code, file }: { title: string; help: string; code: string; file: string }) {
  return (
    <div className="out">
      <div className="copyrow"><h3>{title}</h3><span style={{ display: "flex", gap: 8 }}><CopyButton text={code} /><button className="btn quiet xs" type="button" onClick={() => save(file, code)}>Download</button></span></div>
      <p className="small muted">{help}</p>
      <div className="codebox"><pre>{code}</pre></div>
    </div>
  );
}

/* ---------- generated files ---------- */
function widgetHtml(name: string, language: string, g: NonNullable<AgentsState["geo"]>) {
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
function schemaHtml(view: ScanView, g: NonNullable<AgentsState["geo"]>) {
  const p = view.profile, f = g.facts || {};
  const biz = { "@context": "https://schema.org", "@type": "LocalBusiness", name: p.name, url: p.website, description: f.description || undefined, telephone: f.phone || undefined, email: f.email || undefined, priceRange: f.priceRange || undefined, openingHours: f.openingHours || undefined, address: f.address || p.city ? { "@type": "PostalAddress", streetAddress: f.address || undefined, postalCode: f.postalCode || undefined, addressLocality: p.city || undefined, addressCountry: p.country } : undefined };
  const faq = g.faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) } : null;
  const tag = (o: object) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`;
  return [tag(biz), faq && tag(faq)].filter(Boolean).join("\n");
}
function blogHtml(b: Blog) {
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
function drawPost(canvas: HTMLCanvasElement, post: { headline: string; quote: string }, review: ReviewItem | undefined, biz: { name: string; city: string; domain: string }) {
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

/* ---------- main ---------- */
export function Agents({ view, reload }: { view: ScanView; reload: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | undefined>(view.agents.seo?.picked);
  const [postIdx, setPostIdx] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const a = view.agents;
  const p = view.profile;

  async function run(id: string, keyword?: string) {
    setBusy(keyword ? "blog" : id);
    setErrors((e) => ({ ...e, [id]: "" }));
    const r = await fetch(`/api/scan/${view.id}/agents/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(keyword ? { keyword } : {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErrors((e) => ({ ...e, [id]: j.error || "The agent stopped. Try again." }));
    await reload();
    setBusy(null);
  }

  const post = a.social?.posts[postIdx];
  useEffect(() => {
    if (!canvas.current || !post) return;
    const draw = () => drawPost(canvas.current!, post, a.geo?.reviews[post.review], { name: p.name, city: p.city, domain: p.domain });
    draw();
    document.fonts?.ready.then(draw);
  }, [post, a.geo, p.name, p.city, p.domain]);

  if (!view.access.agents)
    return (
      <>
        <div className="crew">
          {AGENTS.map((ag) => (
            <article key={ag.id} className={`crew-card a-${ag.id}`}>
              <div className="avatar">{ICON[ag.id]}</div>
              <div><h3>{ag.name}</h3><p className="role">{ag.role}</p></div>
              <ul>{ag.does.map((d) => <li key={d}>{d}</li>)}</ul>
            </article>
          ))}
        </div>
        <div className="unlock">
          <h2 style={{ fontSize: 26 }}>Your agents come with Growth</h2>
          <p>€29 a month. They use your own website and your real reviews, and nothing is made up.</p>
          <div><a className="btn" href={view.access.signedIn ? "/pricing" : `/signup?scan=${view.id}&plan=growth`}>Get Growth</a></div>
        </div>
      </>
    );

  return (
    <>
      <p className="muted">Your agents use your website and your real reviews. Nothing is made up: if they can&apos;t find something, they tell you.</p>
      {AGENTS.map((ag) => {
        const working = busy === ag.id || (ag.id === "seo" && busy === "blog");
        const done = !!a[ag.id as keyof AgentsState];
        return (
          <article key={ag.id} className={`agent a-${ag.id}`}>
            <div className="head">
              <div className="avatar">{ICON[ag.id]}</div>
              <div style={{ minWidth: 0 }}>
                <h2>{ag.name}</h2>
                <p className="role">{ag.role}</p>
                <p className="what">{ag.what}</p>
              </div>
            </div>
            <div className="body">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn run small" type="button" disabled={!!busy} onClick={() => run(ag.id)}>{working ? "Working…" : done ? "Run again" : `Run ${ag.name}`}</button>
                <span className={`status ${working ? "working" : done ? "done" : ""}`}>{working ? (busy === "blog" ? "Writing your blog… (up to a minute)" : "Working… (up to a minute)") : done ? "Done" : "Ready"}</span>
              </div>
              {errors[ag.id] && <p className="error" role="alert">{errors[ag.id]}</p>}

              {ag.id === "geo" && a.geo && (
                <>
                  {a.geo.reviews.length ? (
                    <div className="out">
                      <h3>{a.geo.reviews.length} real review{a.geo.reviews.length === 1 ? "" : "s"} from Google{a.geo.rating ? `, rated ${a.geo.rating.value} / 5${a.geo.rating.count ? ` from ${a.geo.rating.count} reviews` : ""}` : ""}</h3>
                      <div className="reviews">
                        {a.geo.reviews.map((r, i) => (
                          <div className="rev" key={i}>
                            {r.rating && <span className="stars" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</span>}
                            <q>{r.quote}</q>
                            <span className="by">{r.author || "Customer"}{r.when ? `, ${r.when}` : ""}, {r.url ? <a href={r.url} target="_blank" rel="noopener">{r.source}</a> : r.source}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="notice">{a.geo.note || `We couldn't find Google reviews for ${p.name}.`} Ask your happiest customers for a Google review, then run the agent again.</p>
                  )}
                  {a.geo.reviews.length > 0 && <Code title="Review block for your website" help="Paste this where you want your reviews to show, for example on your homepage. Each review links to Google." code={widgetHtml(p.name, p.language || "en", a.geo)} file="reviews.html" />}
                  <Code title="Business details for AI" help="Paste this inside the <head> of your homepage. It tells AI and Google your name, address, hours and FAQ without guessing." code={schemaHtml(view, a.geo)} file="schema.html" />
                  {a.geo.faq.length > 0 && <Code title="FAQ for your website" help="Put these questions and answers on a FAQ page or at the bottom of your homepage." code={a.geo.faq.map((f) => `${f.q}\n${f.a}`).join("\n\n")} file="faq.txt" />}
                  {a.geo.llms && <Code title="llms.txt" help={`Upload this file to your website so it opens at ${p.website.replace(/\/$/, "")}/llms.txt.`} code={a.geo.llms} file="llms.txt" />}
                </>
              )}

              {ag.id === "seo" && a.seo && (
                <>
                  <div className="out">
                    <h3>Pick a search to write about</h3>
                    <div className="kw" role="group" aria-label="Searches">
                      {a.seo.keywords.map((k) => (
                        <button key={k.keyword} type="button" aria-pressed={(picked || a.seo!.picked) === k.keyword} title={k.why} onClick={() => setPicked(k.keyword)}>{k.keyword}{k.real ? "" : " *"}</button>
                      ))}
                    </div>
                    {a.seo.keywords.some((k) => !k.real) && <p className="small muted">* our suggestion, not a live Google search</p>}
                    <div><button className="btn run small" type="button" disabled={!!busy} onClick={() => run("seo", picked || a.seo!.picked)}>{busy === "blog" ? "Writing…" : a.seo.blog ? "Write another blog" : "Write the blog"}</button></div>
                  </div>
                  {a.seo.blog && (
                    <>
                      <div className="out">
                        <h3>How it shows up in Google</h3>
                        <div className="serp"><span className="u">{p.domain} › {a.seo.blog.slug}</span><span className="t">{a.seo.blog.title}</span><span className="d">{a.seo.blog.meta}</span></div>
                      </div>
                      <div className="out">
                        <h3>Your blog</h3>
                        <div className="blog">
                          <h2 style={{ fontSize: 24 }}>{a.seo.blog.title}</h2>
                          <p>{a.seo.blog.intro}</p>
                          {a.seo.blog.sections.map((s, i) => (
                            <div key={i}><h3>{s.heading}</h3>{s.paragraphs.map((x, j) => <p key={j}>{x}</p>)}{s.bullets.length > 0 && <ul>{s.bullets.map((x, j) => <li key={j}>{x}</li>)}</ul>}</div>
                          ))}
                          {a.seo.blog.faq.map((f, i) => <p key={i}><strong>{f.q}</strong><br />{f.a}</p>)}
                          <p><strong>{a.seo.blog.cta}</strong></p>
                        </div>
                      </div>
                      <Code title="Blog as HTML" help="Paste into a new blog post on your website (WordPress: use a Custom HTML block)." code={blogHtml(a.seo.blog)} file={`${a.seo.blog.slug || "blog"}.html`} />
                    </>
                  )}
                </>
              )}

              {ag.id === "social" && a.social && (
                a.social.posts.length && post ? (
                  <div className="postwrap">
                    <canvas ref={canvas} role="img" aria-label="Post image with a customer review" />
                    <div className="out">
                      <h3>Caption</h3>
                      <div className="caption">{`${post.caption}\n\n${post.hashtags.join(" ")}`}</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn run small" type="button" onClick={() => canvas.current?.toBlob((b) => b && save(`${p.domain.split(".")[0]}-review-post.png`, b), "image/png")}>Download image</button>
                        <CopyButton text={`${post.caption}\n\n${post.hashtags.join(" ")}`} label="Copy caption" />
                        {a.social.posts.length > 1 && <button className="btn quiet small" type="button" onClick={() => setPostIdx((i) => (i + 1) % a.social!.posts.length)}>Next post ({postIdx + 1}/{a.social.posts.length})</button>}
                      </div>
                      <p className="small muted">Post it on Instagram or TikTok. Tag the reviewer only if they agree.</p>
                    </div>
                  </div>
                ) : (
                  <p className="notice">We need at least one good Google review to make a post. Collect a few reviews first, then run the agent again.</p>
                )
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
