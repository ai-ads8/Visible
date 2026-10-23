"use client";
import { useState } from "react";
import type { ScanView } from "@/lib/view";

/* Highlights the recommended businesses inside the AI's answer; the owner's own name in violet. */
function Marked({ text, names, you }: { text: string; names: string[]; you: string }) {
  const list = [...new Set([...names, you])].filter((n) => n && n.length > 2).sort((a, b) => b.length - a.length);
  if (!list.length) return <>{text}</>;
  const re = new RegExp(`(${list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) => {
        const hit = list.find((n) => n.toLowerCase() === part.toLowerCase());
        if (!hit) return <span key={i}>{part}</span>;
        return <mark key={i} className={hit.toLowerCase() === you.toLowerCase() ? "you" : ""}>{part}</mark>;
      })}
    </>
  );
}

export function ChatAnswers({ view }: { view: ScanView }) {
  const r = view.round!;
  const [all, setAll] = useState(false);
  const list = all ? r.answers : r.answers.slice(0, 2);
  return (
    <div className="card">
      <h2>What AI tells your customers</h2>
      <p className="sub">Real questions, real answers{r.kind === "demo" ? " (sample text in test mode)" : ""}. Recommended businesses are highlighted.</p>
      <div className="chats">
        {list.map((a, i) => (
          <div className="chatx" key={i} style={{ animationDelay: `${i * 120}ms` }}>
            <div className="ask">{a.question}</div>
            <div className="reply">
              <div className="who">{a.model === "Sample" ? "Sample answer" : `${a.model} answered`}</div>
              <p><Marked text={a.text} names={a.businesses} you={view.profile.name} /></p>
              {a.mention === "named" ? (
                <div className="verdict-row in">You&apos;re in this answer{a.position ? `, at #${a.position}` : ""}</div>
              ) : a.mention === "linked" ? (
                <div className="verdict-row half">Your website was a source, but AI didn&apos;t name you</div>
              ) : (
                <div className="verdict-row out">You&apos;re not in this answer</div>
              )}
            </div>
          </div>
        ))}
        {!all && r.answers.length > 2 && (
          <button className="btn quiet small" type="button" onClick={() => setAll(true)}>Show all {r.answers.length} answers</button>
        )}
        {r.lockedAnswers > 0 && (
          <div className="chatx locked" aria-label={`${r.lockedAnswers} more answers are locked`}>
            <div className="ask">Another customer question</div>
            <div className="reply"><p className="shade">The AI assistant recommended several businesses for this question and explained why each one fits.</p></div>
            <div className="lockpill">{r.lockedAnswers} more answer{r.lockedAnswers === 1 ? "" : "s"} in the full report</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Competitors({ view }: { view: ScanView }) {
  const r = view.round!;
  const running = r.status === "running";
  const asked = running ? r.done : r.total;
  const max = Math.max(1, ...view.competitors.map((c) => c.count));
  if (!view.competitors.some((c) => c.count > 0) && running) return null;
  return (
    <div className="card">
      <h2>Who AI recommends instead</h2>
      <p className="sub">{running ? "So far." : `How often each business came up, across ${r.total} questions.`}</p>
      <ul className="rank">
        {view.competitors.slice(0, view.access.unlocked ? 12 : 6).map((c, i) => (
          <li key={i} className={`${c.isYou ? "you" : ""}${c.locked ? " locked" : ""}`}>
            <span className="pos">{i + 1}</span>
            <span className="name">{c.locked ? "Hidden business name" : c.isYou ? `${c.name} (you)` : c.name}</span>
            <span className="count">{c.count} of {asked}</span>
            <span className="bar"><b style={{ width: `${(c.count / max) * 100}%`, animationDelay: `${i * 80}ms` }} /></span>
          </li>
        ))}
      </ul>
      {!view.access.unlocked && view.competitors.some((c) => c.locked) && <p className="small muted">{view.competitors.filter((c) => c.locked).length} more businesses are hidden on the free scan.</p>}
    </div>
  );
}
