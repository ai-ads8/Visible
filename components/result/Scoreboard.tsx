"use client";
import { useState } from "react";
import type { ScanView, ScoreRow } from "@/lib/view";

/*
 * Every customer question as a row: won (AI named you), half (only your site was a source), lost (AI named
 * others), or still being asked. Lost rows offer the next step: a page that answers that exact question.
 */

type Filter = "all" | "lost" | "won";

export const VERDICT: Record<ScoreRow["status"], string> = { named: "Won", linked: "Source only", absent: "Lost", pending: "Asking AI" };

function Verdict({ r }: { r: ScoreRow }) {
  return (
    <span className={`verdict-chip ${r.status}`}>
      {VERDICT[r.status]}
      {r.status === "named" && r.position ? ` · #${r.position}` : ""}
    </span>
  );
}

function Delta({ r }: { r: ScoreRow }) {
  if (!r.was || r.status === "pending") return null;
  const now = r.status === "named", then = r.was === "named";
  if (now && !then) return <span className="delta up">New win</span>;
  if (!now && then) return <span className="delta down">Lost since last check</span>;
  return null;
}

export function Scoreboard({ view, onWrite, onOpen, busyQuestion }: { view: ScanView; onWrite: (questionId: string) => void; onOpen: (pageId: string) => void; busyQuestion: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = view.scoreboard;
  const r = view.round!;
  const won = rows.filter((x) => x.status === "named").length;
  const lost = rows.filter((x) => x.status === "absent" || x.status === "linked").length;
  const shown = rows.map((x, i) => ({ x, i })).filter(({ x }) => (filter === "all" ? true : filter === "won" ? x.status === "named" : x.status === "absent" || x.status === "linked"));
  const running = r.status === "running";
  const canWrite = view.access.pages && view.access.measure !== "off";

  return (
    <section className="board anchor" id="scoreboard" aria-labelledby="board-h">
      <div className="board-head">
        <div>
          <h2 id="board-h">Your scoreboard</h2>
          <p className="sub">{running ? `Asking AI your customers' questions, ${r.done} of ${r.total} done.` : `${r.total} questions your customers ask AI${r.finishedAt ? `, checked ${new Date(r.finishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.`}</p>
        </div>
        <div>
          <div className="tally" aria-label={`${won} won, ${lost} lost`}>
            <span className="w">{won}</span>
            <span className="sep">–</span>
            <span className="l">{lost}</span>
          </div>
          <p className="tally-label">won – lost</p>
        </div>
      </div>

      {!running && rows.length > 3 && (
        <div className="board-filter" role="group" aria-label="Show questions">
          {(["all", "lost", "won"] as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? `All ${rows.length}` : f === "lost" ? `Lost ${lost}` : `Won ${won}`}
            </button>
          ))}
        </div>
      )}

      <ol className="brows">
        {shown.map(({ x, i }) => {
          const losing = x.status === "absent" || x.status === "linked" || (x.status === "named" && (x.position || 1) > 1);
          return (
            <li key={x.id} className={`brow ${x.status}${x.status !== "pending" ? " reveal" : ""}`}>
              <span className="num">{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <p className={`q${x.locked ? " locked" : ""}`}>{x.locked ? "A question your customers ask" : x.text}</p>
                <div className="meta">
                  <Delta r={x} />
                  {x.status === "named" && x.rivals.length > 0 && <span>Also named</span>}
                  {(x.status === "absent" || x.status === "linked") && x.rivals.length > 0 && <span>AI picked</span>}
                  {x.rivals.length > 0 && (
                    <span className="rivals">
                      {x.rivals.map((n) => <span className="rival" key={n} title={n}>{n}</span>)}
                    </span>
                  )}
                  {x.status === "absent" && x.rivals.length === 0 && !x.locked && <span>AI named no business here, so any clear page can take it</span>}
                  {x.locked && x.status !== "pending" && <span>Unlock to see who AI picked</span>}
                </div>
              </div>
              <div className="side">
                <Verdict r={x} />
                {x.page ? (
                  <button type="button" className={`pagechip${x.page.live ? " live" : ""}`} onClick={() => onOpen(x.page!.id)}>
                    {x.page.live ? "Page live" : x.page.status === "approved" ? "Page approved" : "Page draft"}
                  </button>
                ) : canWrite && !running && losing && !x.locked ? (
                  <button type="button" className="btn xs" disabled={!!busyQuestion} onClick={() => onWrite(x.id)}>
                    {busyQuestion === x.id ? "Writing…" : x.status === "named" ? "Get to #1" : "Win this"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {!running && (
        <div className="board-foot">
          <span>
            {view.access.pages
              ? lost
                ? `Tap “Win this” on a lost question and the page agent writes the page that answers it.`
                : "You win every question. Keep checking: AI answers change."
              : lost
                ? `${lost} lost question${lost === 1 ? "" : "s"}. On Growth, the page agent writes a page for each one.`
                : "You win every question on the free check."}
          </span>
          {!view.access.pages && lost > 0 && (
            <a className="btn small" href={view.access.signedIn ? "/pricing" : `/signup?scan=${view.id}&plan=growth`}>Win them back</a>
          )}
        </div>
      )}
    </section>
  );
}
