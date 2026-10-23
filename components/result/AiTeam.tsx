"use client";
import { useEffect, useRef, useState } from "react";
import type { ScanView } from "@/lib/view";
import type { AgentsState } from "@/lib/types";
import { AGENTS, ICON } from "../agentsMeta";
import { Code, CopyButton, blogHtml, drawPost, save, schemaHtml, stars, widgetHtml } from "./agentKit";

type AgentId = "geo" | "seo" | "social";
type Task = { label: string; done: boolean };

/* What each agent will do for THIS business, from the website check. Honest: tasks come from real findings. */
function tasksFor(id: AgentId, view: ScanView): Task[] {
  const a = view.agents;
  const st = (cid: string) => view.checklist.find((c) => c.id === cid)?.status;
  if (id === "geo")
    return [
      { label: "Collect your Google reviews", done: !!a.geo },
      { label: st("reviews") === "good" ? "Refresh the reviews on your site" : "Put reviews on your website", done: !!a.geo?.reviews.length },
      { label: st("schema") === "good" ? "Check your business details for AI" : "Write business details AI can read", done: !!a.geo },
      { label: st("faq") === "good" ? "Improve your FAQ" : "Write an FAQ for your site", done: !!a.geo?.faq.length },
      { label: "Create your llms.txt", done: !!a.geo?.llms },
    ];
  if (id === "seo")
    return [
      { label: `Find what people search${view.profile.city ? ` in ${view.profile.city}` : ""}`, done: !!a.seo },
      { label: "Pick searches that bring customers", done: !!a.seo?.keywords.length },
      { label: st("depth") === "good" ? "Write a blog for a new search" : "Write a blog (your site has little content)", done: !!a.seo?.blog },
    ];
  return [
    { label: "Pick your best reviews", done: !!a.social },
    { label: "Design post images", done: !!a.social?.posts.length },
    { label: "Write captions and hashtags", done: !!a.social?.posts.length },
  ];
}

/* The phases each run goes through, shown while the agent works. */
function stepsFor(id: AgentId | "blog", view: ScanView, keyword?: string): string[] {
  const p = view.profile;
  if (id === "geo") return [`Searching Google Maps for ${p.name}`, "Reading your Google reviews", "Reading your website", "Writing business details and FAQ", "Building your review block"];
  if (id === "seo") return [`Looking up Google searches${p.city ? ` in ${p.city}` : ""}`, "Comparing searches with what you offer", "Picking the searches that bring customers"];
  if (id === "blog") return ["Reading your website", `Writing a blog for “${keyword}”`, "Writing a title and description for Google"];
  return [view.agents.geo ? "Picking your best reviews" : "Collecting your Google reviews", "Writing captions in your customers' language", "Designing your posts"];
}

function WorkLog({ steps, agent }: { steps: string[]; agent: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 6500);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <ol className="worklog" aria-live="polite" aria-label={`${agent} is working`}>
      {steps.map((s, j) => (
        <li key={s} className={j < i ? "done" : j === i ? "now" : ""}>
          {s}
          {j === i && <span className="typing" aria-hidden="true"><i /><i /><i /></span>}
        </li>
      ))}
    </ol>
  );
}

export function AiTeam({ view, reload }: { view: ScanView; reload: () => Promise<unknown> }) {
  const [open, setOpen] = useState<AgentId | null>(null);
  const [busy, setBusy] = useState<{ id: AgentId; blog?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | undefined>(view.agents.seo?.picked);
  const [postIdx, setPostIdx] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const a: AgentsState = view.agents;
  const p = view.profile;
  const allowed = view.access.agents;

  async function run(id: AgentId, keyword?: string) {
    setOpen(id);
    setBusy({ id, blog: keyword });
    setErrors((e) => ({ ...e, [id]: "" }));
    const r = await fetch(`/api/scan/${view.id}/agents/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(keyword ? { keyword } : {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErrors((e) => ({ ...e, [id]: j.error || "The agent stopped. Try again." }));
    await reload();
    setBusy(null);
  }

  const post = a.social?.posts[postIdx];
  useEffect(() => {
    if (!canvas.current || !post || open !== "social") return;
    const draw = () => drawPost(canvas.current!, post, a.geo?.reviews[post.review], { name: p.name, city: p.city, domain: p.domain });
    draw();
    document.fonts?.ready.then(draw);
  }, [post, a.geo, p.name, p.city, p.domain, open, busy]);

  useEffect(() => {
    if (open) panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  const sel = AGENTS.find((x) => x.id === open);

  return (
    <section className="team" aria-labelledby="team-h">
      <div className="team-head">
        <div>
          <h2 id="team-h">Your AI team</h2>
          <p className="sub">{allowed ? "Three agents that fix what's missing. Tap one to put it to work." : "Three agents that fix what's missing. Here's what they'd do for you."}</p>
        </div>
        {!allowed && <span className="badge plan">Growth plan</span>}
      </div>

      <div className="tiles">
        {AGENTS.map((ag) => {
          const id = ag.id as AgentId;
          const tasks = tasksFor(id, view);
          const doneN = tasks.filter((t) => t.done).length;
          const working = busy?.id === id;
          const status = working ? "Working…" : doneN === tasks.length ? "All done" : doneN ? `${doneN} of ${tasks.length} done` : `${tasks.length} tasks ready`;
          return (
            <button key={id} type="button" className={`tile a-${id}${open === id ? " open" : ""}${working ? " working" : ""}`} aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
              <span className="avatar halo">{ICON[id]}</span>
              <span className="tile-status">{status}</span>
              <span className="tile-name">{ag.name}</span>
              <span className="tile-role">{ag.role}</span>
              <span className="tprog"><b style={{ width: `${(doneN / tasks.length) * 100}%` }} /></span>
            </button>
          );
        })}
      </div>

      {sel && open && (
        <div ref={panel} className={`workspace a-${open}`}>
          <div className="ws-head">
            <span className="avatar">{ICON[open]}</span>
            <div style={{ minWidth: 0 }}>
              <h3>{sel.name}</h3>
              <p className="muted small">{sel.what}</p>
            </div>
          </div>

          <ul className="tasks">
            {tasksFor(open, view).map((t) => <li key={t.label} className={t.done ? "done" : ""}>{t.label}</li>)}
          </ul>

          {allowed ? (
            <div className="ws-actions">
              <button className="btn run" type="button" disabled={!!busy} onClick={() => run(open)}>{busy?.id === open ? "Working…" : a[open] ? "Run again" : `Start ${sel.name}`}</button>
              {!busy && <span className="small muted">Takes up to a minute.</span>}
            </div>
          ) : (
            <div className="ws-actions">
              <a className="btn run" href={view.access.signedIn ? "/pricing" : `/signup?scan=${view.id}&plan=growth`}>Put your agents to work</a>
              <span className="small muted">Included in Growth, €29 a month.</span>
            </div>
          )}

          {busy?.id === open && <WorkLog key={`${open}-${busy.blog || ""}`} steps={stepsFor(busy.blog ? "blog" : open, view, busy.blog)} agent={sel.name} />}
          {errors[open] && <p className="error" role="alert">{errors[open]}</p>}

          {/* ---------- results ---------- */}
          {open === "geo" && a.geo && busy?.id !== "geo" && (
            <div className="results">
              {a.geo.reviews.length ? (
                <div className="out">
                  <h3>{a.geo.reviews.length} real review{a.geo.reviews.length === 1 ? "" : "s"} from Google{a.geo.rating ? `, rated ${a.geo.rating.value} / 5${a.geo.rating.count ? ` from ${a.geo.rating.count} reviews` : ""}` : ""}</h3>
                  <div className="reviews">
                    {a.geo.reviews.map((r, i) => (
                      <div className="rev pop" key={i} style={{ animationDelay: `${i * 90}ms` }}>
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
            </div>
          )}

          {open === "seo" && a.seo && busy?.id !== "seo" && (
            <div className="results">
              <div className="out">
                <h3>Pick a search to write about</h3>
                <div className="kw" role="group" aria-label="Searches">
                  {a.seo.keywords.map((k) => (
                    <button key={k.keyword} type="button" aria-pressed={(picked || a.seo!.picked) === k.keyword} title={k.why} onClick={() => setPicked(k.keyword)}>{k.keyword}{k.real ? "" : " *"}</button>
                  ))}
                </div>
                {a.seo.keywords.some((k) => !k.real) && <p className="small muted">* our suggestion, not a live Google search</p>}
                <div><button className="btn run small" type="button" disabled={!!busy} onClick={() => run("seo", picked || a.seo!.picked)}>{a.seo.blog ? "Write another blog" : "Write the blog"}</button></div>
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
            </div>
          )}

          {open === "social" && a.social && busy?.id !== "social" && (
            <div className="results">
              {a.social.posts.length && post ? (
                <div className="postwrap">
                  <canvas ref={canvas} className="pop" role="img" aria-label="Post image with a customer review" />
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
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
