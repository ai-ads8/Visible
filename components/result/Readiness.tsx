import type { ScanView } from "@/lib/view";

const sym = { good: "✓", improve: "!", missing: "×" };

const AGENT_FOR: Record<string, string> = { reviews: "GEO", faq: "GEO", schema: "GEO", location: "GEO", hours: "GEO", llms: "GEO", profiles: "GEO", services: "SEO", depth: "SEO", prices: "SEO" };

export function Readiness({ view, onAgent, showAgentLinks }: { view: ScanView; onAgent?: () => void; showAgentLinks?: boolean }) {
  const r = view.readiness;
  const say = r.score >= 80 ? "Your website gives AI most of what it needs." : r.score >= 55 ? "AI can find you, but it's missing important details." : "AI is missing a lot of what it needs to recommend you.";
  return (
    <>
      <div className="card">
        <div className="ready-head">
          <div className="ring" style={{ ["--v" as string]: r.score }} role="img" aria-label={`AI readiness ${r.score} out of 100`}>
            <div>{r.score}</div>
          </div>
          <div>
            <h2>Website AI readiness</h2>
            <p className="sub">{say}</p>
          </div>
        </div>
        <div className="groups">
          {r.groups.map((g) => (
            <div className="group" key={g.id}>
              <span>{g.title}</span>
              <span className="muted">{g.score}</span>
              <span className="bar"><b style={{ width: `${g.score}%` }} /></span>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>Based on {r.pagesRead} page{r.pagesRead === 1 ? "" : "s"} of your website.</p>
      </div>

      {view.fixes.length > 0 && (
        <div className="card">
          <h2>{view.access.unlocked ? "What to fix" : "Fix these first"}</h2>
          <p className="sub">Most important first. Each one makes it easier for AI to recommend you.</p>
          <div style={{ marginTop: 8 }}>
            {view.fixes.map((f) => (
              <div className="fix" key={f.id}>
                <span className={`mark ${f.status}`} aria-hidden="true">{sym[f.status]}</span>
                <p className="label">{f.label}</p>
                <p className="why">{f.why}</p>
                <p className="todo"><strong>Do this:</strong> {f.fix} {showAgentLinks && AGENT_FOR[f.id] && onAgent ? <button type="button" className="linkbtn" onClick={onAgent}>Let the {AGENT_FOR[f.id]} agent do it</button> : null}{f.evidence ? <span className="ev" style={{ display: "block" }}>Found: {f.evidence}</span> : null}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Full checklist</h2>
        <ul className="checklist">
          {view.checklist.map((c) => (
            <li key={c.id}>
              <span className={`mark ${c.status}`} aria-label={c.status}>{sym[c.status]}</span>
              <span>
                {c.label}
                {c.fix && c.status !== "good" && view.access.unlocked && <span className="muted" style={{ display: "block", fontSize: 14 }}>{c.fix}</span>}
              </span>
              {!c.fix && c.status !== "good" && <span className="lock">How to fix: locked</span>}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
