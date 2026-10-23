"use client";
import { useEffect, useState } from "react";
import type { ScanView } from "@/lib/view";

/* Counts up from 0 to the value once, for the reveal. Respects reduced motion. */
function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Gauge({ value, label, size = 168 }: { value: number; label: string; size?: number }) {
  const shown = useCountUp(value);
  const r = 70, c = 2 * Math.PI * r;
  const tone = value >= 80 ? "#3bce7b" : value >= 55 ? "#ffc24b" : "#ff7a7e";
  return (
    <div className="gauge" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value} out of 100`}>
      <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--night-line)" strokeWidth="12" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform="rotate(-90 80 80)" />
      </svg>
      <div className="gauge-num"><b>{shown}</b><span>{label}</span></div>
    </div>
  );
}

const label = { named: "recommended you", linked: "only linked your site", absent: "didn't recommend you", pending: "not asked yet" };

export function ScoreHero({ view }: { view: ScanView }) {
  const r = view.round;
  const running = r?.status === "running";
  const named = useCountUp(r?.named || 0, 800);
  const top = view.competitors.find((c) => !c.isYou && c.count > 0);
  const line = !r
    ? view.access.measure === "off"
      ? "Your website check is ready. The AI check switches on soon."
      : "Your website check is ready. Next: we ask AI what your customers ask."
    : running
      ? r.done === 0
        ? "Asking AI your first customer question…"
        : `Recommended in ${r.named} of ${r.done} so far.`
      : r.named === 0
        ? `AI didn't recommend you for any of the ${r.total} questions${top?.name ? `. It picked ${top.name} ${top.count === 1 ? "once" : `${top.count} times`} instead.` : "."}`
        : r.named === r.total
          ? `AI recommended you for every one of the ${r.total} questions.`
          : `AI recommended you for ${r.named} of ${r.total} customer questions.`;

  return (
    <div className="hero2" aria-live="polite">
      <div className="hero2-grid">
        <Gauge value={view.readiness.score} label="website ready" />
        <div className="hero2-main">
          <p className="k">{r ? (running ? `Asking AI… ${r.done} of ${r.total}` : "Recommended by AI") : "Your AI visibility"}</p>
          {r ? (
            <div className="big">{running ? r.named : named}<span>/{running ? r.done || r.total : r.total}</span></div>
          ) : (
            <div className="big dim">–</div>
          )}
          <p className="line">{line}</p>
        </div>
      </div>
      {r && (
        <div className="qstrip" aria-label="Each customer question">
          {r.dots.map((d, i) => (
            <span key={i} className={`qdot ${running && i === r.done ? "active" : d.mention}`} style={{ animationDelay: `${i * 70}ms` }} title={d.question ? `${d.question}: ${label[d.mention]}` : label[d.mention]} aria-label={`Question ${i + 1}: ${label[d.mention]}`}>
              {i + 1}
            </span>
          ))}
        </div>
      )}
      <div className="hero2-stats">
        {view.readiness.groups.map((g) => (
          <div key={g.id} className="mini">
            <span>{g.title}</span>
            <span className="mbar"><b style={{ width: `${g.score}%` }} /></span>
          </div>
        ))}
      </div>
      {r?.error && running && <p className="progress">{r.error}</p>}
    </div>
  );
}
