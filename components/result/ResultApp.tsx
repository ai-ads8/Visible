"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanView } from "@/lib/view";
import { ConfirmCard } from "./ConfirmCard";
import { Verdict } from "./Verdict";
import { Readiness } from "./Readiness";
import { Answers } from "./Answers";
import { Unlock } from "./Unlock";

export function ResultApp({ id }: { id: string }) {
  const [view, setView] = useState<ScanView | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [checkError, setCheckError] = useState("");
  const running = useRef(false);

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

  useEffect(() => {
    load().then((v) => {
      if (v && v.round?.status === "running" && v.access.control) drive(v.round.id);
    });
  }, [load, drive]);

  async function startCheck() {
    setStarting(true);
    setCheckError("");
    const r = await fetch(`/api/scan/${id}/check`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setStarting(false);
    if (!r.ok) return setCheckError(j.error || "The AI check couldn't start.");
    await load();
    drive(j.roundId);
  }

  if (error)
    return (
      <section className="result">
        <div className="wrap">
          <div className="card">
            <h2>{error}</h2>
            <p className="sub">If you ran this scan on another device, sign in or start a new scan.</p>
            <p style={{ marginTop: 18 }}><a className="btn" href="/#scan">Scan my website</a></p>
          </div>
        </div>
      </section>
    );

  if (!view)
    return (
      <section className="result">
        <div className="wrap stack">
          <div className="skeleton" style={{ width: "40%" }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 22 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 22 }} />
        </div>
      </section>
    );

  const p = view.profile;
  const icon = `https://${p.domain}/favicon.ico`;
  const needsConfirm = view.access.control && !p.confirmed;
  const canStart = view.access.control && p.confirmed && !view.round && view.access.measure !== "off";

  return (
    <section className="result">
      <div className="wrap">
        <div className="site-chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
          <span>{p.domain}</span>
        </div>
        <h1 style={{ fontSize: "clamp(32px, 7vw, 52px)" }}>{p.name}</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          {view.round?.status === "done" ? "Here's how AI sees your business." : needsConfirm ? "Your website check is ready. One quick step before we ask AI." : "Your website check is ready."}
        </p>

        <div className="flow" style={{ marginTop: 24 }}>
          {view.round?.kind === "demo" && (
            <p className="notice">
              Test mode: these are sample answers with made-up businesses, not real AI results. Live AI checks are switched off.
            </p>
          )}

          {needsConfirm && <ConfirmCard view={view} onSaved={load} />}

          {view.round && <Verdict view={view} />}

          {canStart && (
            <div className="card">
              <h2>Now let&apos;s ask AI</h2>
              <p className="sub">
                We&apos;ll ask {Math.min(view.questions.length, view.access.unlocked ? 20 : 5)} questions your customers ask, like “{view.questions[0]?.text}”. It takes about a minute.
              </p>
              <div style={{ marginTop: 18 }}>
                <button className="btn" onClick={startCheck} disabled={starting}>{starting ? "Starting…" : "Check AI now"}</button>
              </div>
              {checkError && <p className="error" role="alert">{checkError}</p>}
            </div>
          )}
          {view.round && checkError && <p className="error" role="alert">{checkError}</p>}

          {view.access.control && p.confirmed && !view.round && view.access.measure === "off" && (
            <div className="card">
              <h2>The AI check is almost ready</h2>
              <p className="sub">We&apos;re switching on live AI checks. Your website check below is complete and free. Create an account and we&apos;ll keep your results.</p>
              {!view.access.signedIn && <p style={{ marginTop: 18 }}><a className="btn" href={`/signup?scan=${view.id}`}>Save my results</a></p>}
            </div>
          )}

          {view.round && view.round.answers.length > 0 && <Answers view={view} />}

          <Readiness view={view} />

          {!view.access.unlocked && <Unlock view={view} />}
        </div>
      </div>
    </section>
  );
}
