import type { ScanView } from "@/lib/view";

const label = { named: "Named you", linked: "Only linked your site", absent: "Didn't name you", pending: "Not asked yet" };

export function Verdict({ view }: { view: ScanView }) {
  const r = view.round!;
  const running = r.status === "running";
  const others = view.competitors.filter((c) => !c.isYou && c.count > 0);
  const top = others[0];
  const asked = running ? r.done : r.total;
  const max = Math.max(1, ...view.competitors.map((c) => c.count));

  return (
    <>
      <div className="verdict" aria-live="polite">
        {running ? (
          <>
            <div className="big">{r.named}<span>/{r.done}</span></div>
            <p className="line">{r.done === 0 ? "Asking AI your first customer question…" : `Named in ${r.named} of ${r.done} so far. Asked ${r.done} of ${r.total} questions.`}</p>
          </>
        ) : (
          <>
            <div className="big">{r.named}<span>/{r.total}</span></div>
            <p className="line">
              {r.named === 0
                ? `AI didn't name you in any of the ${r.total} questions${top?.name ? `. It recommended ${top.name} ${top.count === 1 ? "once" : `${top.count} times`} instead.` : "."}`
                : r.named === r.total
                  ? `AI named you in every one of the ${r.total} questions.`
                  : `AI named you in ${r.named} of ${r.total} customer questions.`}
            </p>
          </>
        )}
        <div className="dots">
          {r.dots.map((d, i) => (
            <span
              key={i}
              className={`dot ${d.mention}${running && i === r.done ? " active" : ""}`}
              title={d.question ? `${d.question} — ${label[d.mention]}` : label[d.mention]}
              aria-label={`Question ${i + 1}: ${label[d.mention]}`}
            />
          ))}
        </div>
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: "var(--signal)" }} />Named you</span>
          <span><i style={{ border: "1.5px solid #cfccdb" }} />Didn&apos;t name you</span>
          {r.dots.some((d) => d.mention === "linked") && <span><i style={{ background: "var(--signal-wash)", border: "1.5px solid var(--signal)" }} />Only linked your site</span>}
        </div>
        {r.error && running && <p className="progress">{r.error}</p>}
      </div>

      {(others.length > 0 || !running) && (
        <div className="card">
          <h2>Who AI recommends</h2>
          <p className="sub">{running ? "So far, across the questions asked." : `Across ${r.total} customer questions.`}</p>
          <ul className="rank">
            {view.competitors.slice(0, view.access.unlocked ? 12 : 6).map((c, i) => (
              <li key={i} className={`${c.isYou ? "you" : ""}${c.locked ? " locked" : ""}`}>
                <span className="name">{c.locked ? "Hidden business name" : c.isYou ? `${c.name} (you)` : c.name}</span>
                <span className="count">{c.count} of {asked}</span>
                <span className="bar"><b style={{ width: `${(c.count / max) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
          {!view.access.unlocked && view.competitors.some((c) => c.locked) && (
            <p className="small muted" style={{ marginTop: 14 }}>{view.competitors.filter((c) => c.locked).length} more businesses are hidden on the free scan.</p>
          )}
        </div>
      )}
    </>
  );
}
