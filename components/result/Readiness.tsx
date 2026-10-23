import type { ScanView } from "@/lib/view";

const sym = { good: "✓", improve: "!", missing: "×" };

const AGENT_FOR: Record<string, string> = { reviews: "GEO", faq: "GEO", schema: "GEO", location: "GEO", hours: "GEO", llms: "GEO", profiles: "GEO", services: "SEO", depth: "SEO", prices: "SEO" };

export function Readiness({ view, onAgent, showAgentLinks }: { view: ScanView; onAgent?: () => void; showAgentLinks?: boolean }) {
  return (
    <>
      {view.fixes.length > 0 && (
        <div className="card">
          <h2>{view.access.unlocked ? "What to fix on your website" : "Fix these first"}</h2>
          <p className="sub">Most important first, from {view.readiness.pagesRead} page{view.readiness.pagesRead === 1 ? "" : "s"} we read. Each one makes it easier for AI to recommend you.</p>
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
        <h2>Full website check</h2>
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
