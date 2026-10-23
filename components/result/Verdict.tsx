import type { ScanView } from "@/lib/view";

const label = { named: "recommended you", linked: "only linked your site", absent: "didn't recommend you", pending: "not asked yet" };

export function Verdict({ view }: { view: ScanView }) {
  const r = view.round!;
  const running = r.status === "running";
  const others = view.competitors.filter((c) => !c.isYou && c.count > 0);
  const top = others[0];
  const asked = running ? r.done : r.total;
  const max = Math.max(1, ...view.competitors.map((c) => c.count));
  const line = running
    ? r.done === 0
      ? "Asking AI your first customer question…"
      : `Recommended in ${r.named} of ${r.done} so far.`
    : r.named === 0
      ? `AI didn't recommend you for any of the ${r.total} questions${top?.name ? `. It picked ${top.name} ${top.count === 1 ? "once" : `${top.count} times`} instead.` : "."}`
      : r.named === r.total
        ? `AI recommended you for every one of the ${r.total} questions.`
        : `AI recommended you for ${r.named} of ${r.total} customer questions.`;

  return (
    <>
      <div className="verdict" aria-live="polite">
        <p className="k">{running ? `Asked ${r.done} of ${r.total} questions` : "Your AI visibility"}</p>
        <div className="big">{r.named}<span>/{running ? r.done || r.total : r.total}</span></div>
        <p className="line">{line}</p>
        <div className="qstrip">
          {r.dots.map((d, i) => (
            <span key={i} className={`qdot ${running && i === r.done ? "active" : d.mention}`} title={d.question ? `${d.question}: ${label[d.mention]}` : label[d.mention]} aria-label={`Question ${i + 1}: ${label[d.mention]}`}>
              {i + 1}
            </span>
          ))}
        </div>
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: "var(--signal)" }} />Recommended you</span>
          <span><i style={{ background: "var(--night-2)", border: "1.5px solid var(--night-line)" }} />Didn&apos;t</span>
        </div>
        {r.error && running && <p className="progress">{r.error}</p>}
      </div>

      {(others.length > 0 || !running) && (
        <div className="card">
          <h2>Who AI recommends</h2>
          <p className="sub">{running ? "So far." : `How often each business was recommended, across ${r.total} questions.`}</p>
          <ul className="rank">
            {view.competitors.slice(0, view.access.unlocked ? 12 : 6).map((c, i) => (
              <li key={i} className={`${c.isYou ? "you" : ""}${c.locked ? " locked" : ""}`}>
                <span className="pos">{i + 1}</span>
                <span className="name">{c.locked ? "Hidden business name" : c.isYou ? `${c.name} (you)` : c.name}</span>
                <span className="count">{c.count} of {asked}</span>
                <span className="bar"><b style={{ width: `${(c.count / max) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
          {!view.access.unlocked && view.competitors.some((c) => c.locked) && (
            <p className="small muted">{view.competitors.filter((c) => c.locked).length} more businesses are hidden on the free scan.</p>
          )}
        </div>
      )}
    </>
  );
}
