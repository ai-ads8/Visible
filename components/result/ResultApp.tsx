"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanView } from "@/lib/view";
import { ConfirmCard } from "./ConfirmCard";
import { ScoreHero } from "./ScoreHero";
import { ChatAnswers, Competitors } from "./ChatAnswers";
import { Readiness } from "./Readiness";
import { Unlock } from "./Unlock";
import { AiTeam } from "./AiTeam";

export function ResultApp({ id }: { id: string }) {
  const [view, setView] = useState<ScanView | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [editing, setEditing] = useState(false);
  const running = useRef(false);
  const autoStarted = useRef(false);
  const teamRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/scan/${id}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error || "This scan couldn't be loaded.");
    setView(j);
    return j as ScanView;
  }, [id]);

  /* Asks the round's questions one at a time; the server enforces the same (a lock), this just drives it. */
  const drive = useCallback(
    async (roundId: string) => {
      if (running.current) return;
      running.current = true;
      try {
        for (let i = 0; i < 25; i++) {
          const r = await fetch(`/api/round/${roundId}/next`, { method: "POST" });
          const j = await r.json().catch(() => ({}));
          await load();
          if (!r.ok) {
            setCheckError(j.error || "The AI check paused.");
            break;
          }
          if (j.status !== "running") break;
          if (j.error) await new Promise((res) => setTimeout(res, 2500));
        }
      } finally {
        running.current = false;
      }
    },
    [load]
  );

  const startCheck = useCallback(async () => {
    setStarting(true);
    setCheckError("");
    const r = await fetch(`/api/scan/${id}/check`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setStarting(false);
    if (!r.ok) return setCheckError(j.error || "The AI check couldn't start.");
    await load();
    drive(j.roundId);
  }, [id, load, drive]);

  useEffect(() => {
    load().then((v) => {
      if (!v) return;
      if (v.round?.status === "running" && v.access.control) drive(v.round.id);
      // Details read automatically from the site: go straight to the AI check, as one flow.
      else if (!v.round && v.access.control && v.profile.confirmed && v.profile.auto && v.access.measure === "live" && !autoStarted.current) {
        autoStarted.current = true;
        startCheck();
      }
    });
  }, [load, drive, startCheck]);

  if (error)
    return (
      <section className="result">
        <div className="wrap">
          <div className="card">
            <h2>{error}</h2>
            <p className="sub">If you ran this scan on another device, sign in or start a new scan.</p>
            <p><a className="btn" href="/#scan">Scan my website</a></p>
          </div>
        </div>
      </section>
    );

  if (!view)
    return (
      <section className="result">
        <div className="wrap stack">
          <div className="skeleton" style={{ width: "40%" }} />
          <div className="skeleton" style={{ height: 260, borderRadius: 28 }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 22 }} />
        </div>
      </section>
    );

  const p = view.profile;
  const needsConfirm = view.access.control && (!p.confirmed || editing);
  const canStart = view.access.control && p.confirmed && !editing && !view.round && view.access.measure !== "off";
  const done = view.round?.status === "done";
  const where = p.reach === "local" ? p.city : "Online";

  return (
    <section className="result dash">
      <div className="wrap">
        <div className="bizhead">
          <div className="mono" aria-hidden="true">{(p.name.match(/\p{L}/u)?.[0] || "V").toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "clamp(28px, 6vw, 44px)" }}>{p.name}</h1>
            <div className="chips">
              {[p.domain, p.category, where].filter(Boolean).map((c) => <span className="chipx" key={c}>{c}</span>)}
              {view.access.control && p.confirmed && !editing && <button className="linkbtn" type="button" onClick={() => setEditing(true)}>Edit details</button>}
            </div>
          </div>
        </div>

        <div className="flow" style={{ marginTop: 20 }}>
          {view.round?.kind === "demo" && <p className="notice">Test mode: sample answers with made-up businesses, not real AI results.</p>}

          {needsConfirm && <ConfirmCard view={view} onSaved={async () => { setEditing(false); await load(); }} />}

          <ScoreHero view={view} />

          {canStart && (
            <div className="card startcard">
              <div>
                <h2>Now let&apos;s ask AI</h2>
                <p className="sub">We&apos;ll ask {Math.min(view.questions.length, view.access.unlocked ? 20 : 5)} questions your customers ask, like “{view.questions[0]?.text}”.</p>
              </div>
              <div><button className="btn" onClick={startCheck} disabled={starting}>{starting ? "Starting…" : "Check AI now"}</button></div>
              {checkError && <p className="error" role="alert">{checkError}</p>}
            </div>
          )}
          {view.round && checkError && <p className="error" role="alert">{checkError}</p>}

          {view.round && view.round.answers.length > 0 && (
            <div className="dash-grid">
              <ChatAnswers view={view} />
              <Competitors view={view} />
            </div>
          )}

          <div ref={teamRef}><AiTeam view={view} reload={load} /></div>

          {done && !view.access.unlocked && <Unlock view={view} onAgents={() => teamRef.current?.scrollIntoView({ behavior: "smooth" })} />}

          <Readiness view={view} onAgent={() => teamRef.current?.scrollIntoView({ behavior: "smooth" })} showAgentLinks />
        </div>
      </div>
    </section>
  );
}
