import type { RoundSummary } from "@/lib/types";

/* Share of questions where AI named the business, per official check. */
export function TrendChart({ history }: { history: RoundSummary[] }) {
  if (history.length < 2) return <p className="small muted" style={{ marginTop: 12 }}>Your progress chart appears after your second check.</p>;
  const pts = history.slice(-30);
  const W = 600, H = 160, pad = 8;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (v: number) => H - pad - v * (H - pad * 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total ? p.named / p.total : 0).toFixed(1)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="How often AI named you, per check">
      {[0, 0.5, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="#e7e6ec" strokeWidth="1" />)}
      <path d={d} fill="none" stroke="#5a3cf0" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.total ? p.named / p.total : 0)} r="3.5" fill="#5a3cf0"><title>{`${p.date.slice(0, 10)}: named in ${p.named} of ${p.total}`}</title></circle>)}
    </svg>
  );
}
