"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ScanView } from "@/lib/view";
import type { WinPage } from "@/lib/types";
import { PLACEHOLDER, openPlaceholders, pageHtml, slugify, wordCount } from "@/lib/pagekit";
import { CopyButton, save } from "./agentKit";

/*
 * Pages that win: one page per lost question. The owner reviews it, fills in what we couldn't find on their site,
 * approves it and publishes it to WordPress or Shopify (or copies the HTML). Nothing goes live without approval.
 */

type Edit = Pick<WinPage, "title" | "slug" | "meta" | "answer" | "sections" | "faqTitle" | "faq" | "cta">;
const pick = (p: WinPage): Edit => ({ title: p.title, slug: p.slug, meta: p.meta, answer: p.answer, sections: p.sections.map((s) => ({ ...s })), faqTitle: p.faqTitle || "", faq: p.faq.map((f) => ({ ...f })), cta: p.cta });

const STATE_LABEL = { draft: "Draft", approved: "Approved", published: "Live" } as const;

async function api(url: string, method: string, data?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "That didn't work. Try again.");
  return j;
}

/* Highlights [[add: …]] placeholders inside text. */
function Holes({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <span key={i} className="ph">{p.replace(/^\s*add\s*:\s*/i, "")}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function Preview({ e, domain }: { e: Edit; domain: string }) {
  return (
    <div className="preview" aria-label="Preview of the page">
      <div className="chrome"><i /><i /><i /> {domain}/{e.slug}</div>
      <div className="doc">
        <h1><Holes text={e.title} /></h1>
        <p className="lead"><Holes text={e.answer} /></p>
        {e.sections.map((s, i) => (
          <div key={i} style={{ display: "grid", gap: 10 }}>
            {s.heading && <h2><Holes text={s.heading} /></h2>}
            {s.text.split(/\n\s*\n/).filter(Boolean).map((para, j) => {
              const lines = para.split("\n").filter(Boolean);
              return lines.every((l) => /^[-•]\s+/.test(l.trim())) ? (
                <ul key={j}>{lines.map((l, k) => <li key={k}><Holes text={l.trim().replace(/^[-•]\s+/, "")} /></li>)}</ul>
              ) : (
                <p key={j}><Holes text={para} /></p>
              );
            })}
          </div>
        ))}
        {e.faq.length > 0 && <h2>{e.faqTitle || "FAQ"}</h2>}
        {e.faq.map((f, i) => (
          <div key={i}><h3><Holes text={f.q} /></h3><p><Holes text={f.a} /></p></div>
        ))}
        {e.cta && <p className="lead"><Holes text={e.cta} /></p>}
      </div>
    </div>
  );
}

function Connect({ view, reload }: { view: ScanView; reload: () => Promise<unknown> }) {
  const [platform, setPlatform] = useState<"wordpress" | "shopify">("wordpress");
  const [site, setSite] = useState(view.profile.website || "");
  const [user, setUser] = useState("");
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  if (!view.access.publish)
    return <p className="notice info">Publishing straight to your website switches on soon. Until then, copy the HTML or download the page and paste it into your site.</p>;

  if (view.cms)
    return (
      <div className="connect">
        <div className="row">
          <span className="site">{view.cms.platform === "wordpress" ? "WordPress" : "Shopify"}: {view.cms.site.replace(/^https?:\/\//, "")}<span className="muted small">as {view.cms.account}</span></span>
          <button className="linkbtn" type="button" onClick={async () => { await api(`/api/scan/${view.id}/cms`, "DELETE"); await reload(); }}>Disconnect</button>
        </div>
      </div>
    );

  if (!open)
    return (
      <div className="connect">
        <div className="row">
          <span className="small muted">Connect your website once, then publish any approved page in one click.</span>
          <button className="btn quiet small" type="button" onClick={() => setOpen(true)}>Connect your website</button>
        </div>
      </div>
    );

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/scan/${view.id}/cms`, "POST", platform === "wordpress" ? { platform, site, user, secret } : { platform, site, clientId: clientId || undefined, secret });
      setSecret("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <form className="connect" onSubmit={submit}>
      <div className="row">
        <h3>Connect your website</h3>
        <div className="toggle" role="group" aria-label="Website platform">
          <button type="button" aria-pressed={platform === "wordpress"} onClick={() => { setPlatform("wordpress"); setSite(view.profile.website || ""); }}>WordPress</button>
          <button type="button" aria-pressed={platform === "shopify"} onClick={() => { setPlatform("shopify"); setSite(""); }}>Shopify</button>
        </div>
      </div>
      {platform === "wordpress" ? (
        <ol className="steps-mini">
          <li>In WordPress, open Users → Profile.</li>
          <li>Under Application passwords, type “Visible” and click Add new.</li>
          <li>Paste the password below with your username. You can revoke it there any time.</li>
        </ol>
      ) : (
        <ol className="steps-mini">
          <li>In the Shopify Dev Dashboard, create an app with the read_content and write_content permissions.</li>
          <li>Install it on your store, then copy the Client ID and Client secret.</li>
          <li>An older custom app works too: leave Client ID empty and paste its Admin API token.</li>
        </ol>
      )}
      <div className="confirm">
        <label className="field"><span>{platform === "wordpress" ? "Website address" : "Store address"}</span><input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder={platform === "wordpress" ? "https://yourbusiness.com" : "yourstore.myshopify.com"} required /></label>
        {platform === "wordpress" ? (
          <div className="two">
            <label className="field"><span>Username</span><input className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" required /></label>
            <label className="field"><span>Application password</span><input className="input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" required /></label>
          </div>
        ) : (
          <div className="two">
            <label className="field"><span>Client ID</span><input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></label>
            <label className="field"><span>Client secret or token</span><input className="input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" required /></label>
          </div>
        )}
      </div>
      <p className="small muted">We test the login before saving it. It's stored encrypted and only used to publish the pages you approve.</p>
      <div className="ws-actions">
        <button className="btn small" disabled={busy}>{busy ? "Testing the login…" : "Connect"}</button>
        <button className="btn quiet small" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function Editor({ view, page, reload, onRewrite, rewriting, onClose }: { view: ScanView; page: WinPage; reload: () => Promise<unknown>; onRewrite: () => void; rewriting: boolean; onClose: () => void }) {
  const [e, setE] = useState<Edit>(() => pick(page));
  const [tab, setTab] = useState<"edit" | "preview" | "google">("preview");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const base = useRef(JSON.stringify(pick(page)));
  // Only reset the form when the saved page itself changed, never on a routine refresh.
  useEffect(() => {
    setE(pick(page));
    base.current = JSON.stringify(pick(page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, page.updatedAt]);
  const dirty = JSON.stringify(e) !== base.current;
  const holes = useMemo(() => openPlaceholders(e), [e]);
  const full: WinPage = { ...page, ...e, faqTitle: e.faqTitle || undefined };
  const html = pageHtml(full);
  const domain = view.profile.domain;

  async function act(label: string, fn: () => Promise<unknown>, okText = "") {
    setBusy(label);
    setError("");
    setDone("");
    try {
      await fn();
      await reload();
      if (okText) setDone(okText);
    } catch (x) {
      setError((x as Error).message);
    }
    setBusy("");
  }
  const saveEdits = (status?: "approved" | "draft") => api(`/api/scan/${view.id}/pages/${page.id}`, "PATCH", { ...(dirty ? { ...e, slug: slugify(e.slug) } : {}), ...(status ? { status } : {}) });
  const set = <K extends keyof Edit>(k: K, v: Edit[K]) => setE((x) => ({ ...x, [k]: v }));
  const changedSinceLive = page.published?.live && page.status !== "published";

  return (
    <div className="editor" id={`page-${page.id}`}>
      <div className="editor-top">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <p className="for">Answers <b>“{page.question}”</b>{page.rivals.length ? <> — AI picks {page.rivals.slice(0, 3).join(", ")} today</> : null}</p>
          <button className="linkbtn" type="button" onClick={onClose}>Close</button>
        </div>
        {page.sample && <p className="notice">Sample page from test mode: made without AI, can&apos;t be approved or published.</p>}
        {page.angle && <p className="angle">{page.angle}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="editor-tabs" role="tablist" aria-label="Page view">
            {(["preview", "edit", "google"] as const).map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "preview" ? "Preview" : t === "edit" ? "Edit" : "In Google"}</button>
            ))}
          </div>
          <span className="small muted">{wordCount(full)} words · <span className={`wp-state ${page.status}`}>{STATE_LABEL[page.status]}</span></span>
        </div>
      </div>

      <div className="editor-body">
        {holes.length > 0 && (
          <div className="holes" role="status">
            <strong>Fill in {holes.length === 1 ? "one thing" : `${holes.length} things`} we couldn&apos;t find on your website:</strong>
            <ul>{holes.map((h) => <li key={h}>{h}</li>)}</ul>
            {tab !== "edit" && <button className="linkbtn" type="button" onClick={() => setTab("edit")} style={{ color: "inherit", justifySelf: "start" }}>Fill them in</button>}
          </div>
        )}

        {tab === "preview" && <Preview e={e} domain={domain} />}

        {tab === "google" && (
          <div className="serp">
            <span className="u">{domain} › {e.slug}</span>
            <span className="t">{e.title}</span>
            <span className="d">{e.meta || e.answer.slice(0, 150)}</span>
          </div>
        )}

        {tab === "edit" && (
          <div className="confirm">
            <label className="field"><span>Title</span><input className="input" value={e.title} maxLength={90} onChange={(x) => set("title", x.target.value)} /></label>
            <label className="field"><span>The answer AI can quote</span><textarea className="textarea" value={e.answer} rows={4} maxLength={900} onChange={(x) => set("answer", x.target.value)} /><small>First on the page. Answer the question directly and name your business and town.</small></label>
            {e.sections.map((s, i) => (
              <div className="sect" key={i}>
                <label className="field"><span>Section {i + 1} heading</span><input className="input" value={s.heading} onChange={(x) => set("sections", e.sections.map((y, j) => (j === i ? { ...y, heading: x.target.value } : y)))} /></label>
                <label className="field"><span>Text</span><textarea className="textarea" rows={5} value={s.text} onChange={(x) => set("sections", e.sections.map((y, j) => (j === i ? { ...y, text: x.target.value } : y)))} /><small>Blank line for a new paragraph. Lines starting with “- ” become a list.</small></label>
                <div className="sect-actions">
                  {i > 0 && <button type="button" className="btn quiet xs" onClick={() => { const a = [...e.sections]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("sections", a); }}>Move up</button>}
                  <button type="button" className="btn danger xs" onClick={() => set("sections", e.sections.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>
            ))}
            {e.sections.length < 8 && <button type="button" className="btn quiet small" style={{ justifySelf: "start" }} onClick={() => set("sections", [...e.sections, { heading: "", text: "" }])}>Add a section</button>}
            <label className="field"><span>FAQ heading</span><input className="input" value={e.faqTitle || ""} maxLength={80} onChange={(x) => set("faqTitle", x.target.value)} /></label>
            {e.faq.map((f, i) => (
              <div className="sect" key={`f${i}`}>
                <label className="field"><span>Question {i + 1}</span><input className="input" value={f.q} onChange={(x) => set("faq", e.faq.map((y, j) => (j === i ? { ...y, q: x.target.value } : y)))} /></label>
                <label className="field"><span>Answer</span><textarea className="textarea" rows={3} value={f.a} onChange={(x) => set("faq", e.faq.map((y, j) => (j === i ? { ...y, a: x.target.value } : y)))} /></label>
                <div className="sect-actions"><button type="button" className="btn danger xs" onClick={() => set("faq", e.faq.filter((_, j) => j !== i))}>Remove</button></div>
              </div>
            ))}
            {e.faq.length < 8 && <button type="button" className="btn quiet small" style={{ justifySelf: "start" }} onClick={() => set("faq", [...e.faq, { q: "", a: "" }])}>Add a question</button>}
            <label className="field"><span>Call to action</span><input className="input" value={e.cta} maxLength={300} onChange={(x) => set("cta", x.target.value)} /></label>
            <div className="two" style={{ display: "grid", gap: 14 }}>
              <label className="field"><span>Web address</span><input className="input" value={e.slug} maxLength={70} onChange={(x) => set("slug", x.target.value)} /><small>{domain}/{slugify(e.slug)}</small></label>
              <label className="field"><span>Google description</span><input className="input" value={e.meta} maxLength={200} onChange={(x) => set("meta", x.target.value)} /><small>{e.meta.length} of 155 characters</small></label>
            </div>
          </div>
        )}

        {page.status !== "draft" && !page.sample && <Connect view={view} reload={reload} />}

        {page.published && (
          <p className="small muted">
            {page.published.live ? "Live on your website" : "Saved as a draft on your website"} since {new Date(page.published.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {page.published.url && <> · <a href={page.published.url} target="_blank" rel="noopener">Open the page</a></>}
            {changedSinceLive && " · Your latest changes aren't published yet."}
            {page.published.live && page.status === "published" && " · We'll see in your next check whether AI picks it up."}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {done && <p className="ok" role="status">{done}</p>}
      </div>

      <div className="editor-actions">
        {dirty && <button className="btn small" type="button" disabled={!!busy} onClick={() => act("save", () => saveEdits(), "Changes saved.")}>{busy === "save" ? "Saving…" : "Save changes"}</button>}
        {page.status === "draft" && !page.sample && (
          <button className="btn win small" type="button" disabled={!!busy || holes.length > 0} title={holes.length ? "Fill in the open points first" : undefined} onClick={() => act("approve", () => saveEdits("approved"), "Approved. Publish it whenever you're ready.")}>
            {busy === "approve" ? "Approving…" : "Approve page"}
          </button>
        )}
        {page.status === "approved" && view.cms && (
          <>
            <button className="btn win small" type="button" disabled={!!busy || dirty} onClick={() => act("live", () => api(`/api/scan/${view.id}/pages/${page.id}/publish`, "POST", { live: true }), "Published on your website.")}>
              {busy === "live" ? "Publishing…" : page.published?.live ? "Publish changes" : "Publish"}
            </button>
            {!page.published?.live && <button className="btn quiet small" type="button" disabled={!!busy || dirty} onClick={() => act("wpdraft", () => api(`/api/scan/${view.id}/pages/${page.id}/publish`, "POST", { live: false }), "Saved as a draft on your website.")}>{busy === "wpdraft" ? "Saving…" : "Save as draft on my site"}</button>}
          </>
        )}
        <CopyButton text={html} label="Copy HTML" />
        <button className="btn quiet xs" type="button" onClick={() => save(`${slugify(e.slug)}.html`, `<h1>${e.title.replace(/</g, "&lt;")}</h1>\n\n${html}`)}>Download</button>
        <span className="spacer" />
        {page.status === "draft" && !page.published && <button className="btn quiet xs" type="button" disabled={!!busy || rewriting} onClick={onRewrite}>{rewriting ? "Rewriting…" : "Rewrite"}</button>}
        <button className="btn danger xs" type="button" disabled={!!busy} onClick={() => { if (confirm(page.published ? "Remove this page from Visible? It stays on your website until you remove it there." : "Delete this page?")) act("del", async () => { await api(`/api/scan/${view.id}/pages/${page.id}`, "DELETE"); onClose(); }); }}>Delete</button>
      </div>
    </div>
  );
}

export function WinPages({ view, reload, openId, setOpenId, busyQuestion, onWrite, writeError }: { view: ScanView; reload: () => Promise<unknown>; openId: string | null; setOpenId: (id: string | null) => void; busyQuestion: string | null; onWrite: (questionId: string) => void; writeError: string }) {
  const pages = view.pages;
  const lost = view.scoreboard.filter((r) => !r.locked && !r.page && (r.status === "absent" || r.status === "linked" || (r.status === "named" && (r.position || 1) > 1)));
  const q = view.pagesQuota;
  const left = Math.max(0, q.limit - q.used);
  const open = pages.find((p) => p.id === openId);
  useEffect(() => {
    if (openId) document.getElementById(`page-${openId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openId]);

  if (!view.access.pages)
    return (
      <section className="wp anchor a-page" id="pages" aria-labelledby="wp-h">
        <div className="wp-head">
          <div>
            <h2 id="wp-h">Pages that win</h2>
            <p className="sub">For every question you lose, the page agent writes one page on your site that answers it: the direct answer first, your real details, an FAQ. You approve it, we publish it, and the next check shows whether AI picks you.</p>
          </div>
          <span className="badge plan">Growth plan</span>
        </div>
        <div className="pageshot" aria-hidden="true">
          <div className="bar"><span className="dots3"><i /><i /><i /></span>{view.profile.domain}/{slugify(`${view.profile.service || view.profile.category} ${view.profile.city}`)}</div>
          <div className="body">
            <h3>{(view.profile.service || view.profile.category).replace(/^./, (c) => c.toUpperCase())}{view.profile.city ? ` in ${view.profile.city}` : ""}</h3>
            <p className="ans">{view.profile.name} answers the question your customers ask, in the first two lines, with your real details.</p>
            <div className="ln" style={{ width: "92%" }} /><div className="ln" style={{ width: "80%" }} /><div className="ln" style={{ width: "86%" }} />
          </div>
          <div className="foot"><span>Draft · written from your website</span><span className="wp-state approved">Ready to approve</span></div>
        </div>
        <div className="ws-actions">
          <a className="btn" href={view.access.signedIn ? "/pricing" : `/signup?scan=${view.id}&plan=growth`}>Start winning questions</a>
          <span className="small muted">4 pages a month on Growth, €29 a month.</span>
        </div>
      </section>
    );

  return (
    <section className="wp anchor" id="pages" aria-labelledby="wp-h">
      <div className="wp-head">
        <div>
          <h2 id="wp-h">Pages that win</h2>
          <p className="sub">One page per lost question, written from your website. Fill in the gaps, approve, publish. Nothing goes live without your OK.</p>
        </div>
        {q.limit > 0 && (
          <div className="quota" aria-label={`${q.used} of ${q.limit} pages written this month`}>
            <span>{left} of {q.limit} pages left this month</span>
            <span className="mbar"><b style={{ width: `${Math.min(100, (q.used / q.limit) * 100)}%` }} /></span>
          </div>
        )}
      </div>

      {writeError && <p className="error" role="alert">{writeError}</p>}

      {pages.length > 0 && (
        <div className="wp-list">
          {pages.map((p) => (
            <Fragment key={p.id}>
              <button type="button" className="wp-item" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                <span style={{ minWidth: 0 }}>
                  <span className="t" style={{ display: "block" }}>{p.title}</span>
                  <span className="for" style={{ display: "block" }}>For “{p.question}”</span>
                </span>
                <span className={`wp-state ${p.status}`}>{p.sample ? "Sample" : STATE_LABEL[p.status]}</span>
              </button>
              {open?.id === p.id && <Editor view={view} page={open} reload={reload} onRewrite={() => onWrite(open.questionId)} rewriting={busyQuestion === open.questionId} onClose={() => setOpenId(null)} />}
            </Fragment>
          ))}
        </div>
      )}

      {lost.length > 0 ? (
        <div className="wp-empty">
          <p>{pages.length ? <><strong>{lost.length} more question{lost.length === 1 ? "" : "s"}</strong> to win.</> : <><strong>Start with one question.</strong> The page agent reads your site and the AI answer, then writes the page in about a minute.</>}</p>
          <div className="wp-candidates">
            {lost.slice(0, 5).map((r) => (
              <div className="wp-cand" key={r.id}>
                <span>“{r.text}”{r.rivals[0] ? <span className="muted small"> — AI picks {r.rivals[0]}</span> : null}</span>
                <button className="btn xs" type="button" disabled={!!busyQuestion || (q.limit > 0 && left === 0 && view.access.measure === "live")} onClick={() => onWrite(r.id)}>{busyQuestion === r.id ? "Writing…" : "Write the page"}</button>
              </div>
            ))}
          </div>
          {busyQuestion && <p className="small muted">The page agent is reading your website and the AI answer…</p>}
        </div>
      ) : pages.length === 0 ? (
        <div className="wp-empty"><p>{view.round?.status === "done" ? <><strong>No lost questions.</strong> AI recommends you first for everything we asked.</> : "Once AI has answered your customers' questions, the ones you lose show up here."}</p></div>
      ) : null}
    </section>
  );
}
