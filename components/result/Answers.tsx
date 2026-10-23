import type { ScanView } from "@/lib/view";

const badge = { named: "Recommended you", linked: "Linked your site", absent: "Didn't recommend you" };

export function Answers({ view }: { view: ScanView }) {
  const r = view.round!;
  return (
    <div className="card">
      <h2>What AI answered</h2>
      <p className="sub">The real answers, word for word{r.kind === "demo" ? " (sample text in test mode)" : ""}.</p>
      <div style={{ marginTop: 10 }}>
        {r.answers.map((a, i) => (
          <div className="answer" key={i}>
            <p className="q">
              “{a.question}”<span className={`badge ${a.mention}`}>{badge[a.mention]}{a.position ? `, #${a.position}` : ""}</span>
            </p>
            <p className="a">{a.text}</p>
            {a.sources.length > 0 && <p className="sources">Sources: {a.sources.slice(0, 4).map((s) => s.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]).join(", ")}</p>}
          </div>
        ))}
        {r.lockedAnswers > 0 && (
          <div className="answer ghost" aria-label={`${r.lockedAnswers} more answers are locked`}>
            <p className="q">{r.lockedAnswers} more answer{r.lockedAnswers === 1 ? "" : "s"}</p>
            <p className="shade">The AI assistant recommended several businesses for this question and explained why each one fits what the customer asked for.</p>
          </div>
        )}
      </div>
    </div>
  );
}
