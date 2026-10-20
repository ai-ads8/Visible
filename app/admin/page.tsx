import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";
import { measureMode, usageToday, HARD_MAX_QUESTIONS, freeRoundsPerIp, freeRoundsPerDay } from "@/lib/guard";
import { billingEnabled } from "@/lib/billing";
import { storageMode, kvGet } from "@/lib/store";
import { measureModel, maxCostPerQuestion } from "@/lib/engine/ai";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Admin() {
  const user = await currentUser();
  if (!isAdmin(user)) notFound();
  const [usage, log, tracked] = await Promise.all([usageToday(), recentAudit(150), kvGet<string[]>("tracked-scans")]);
  const mode = measureMode();
  return (
    <section className="page">
      <div className="wrap">
        <h1>Admin</h1>
        <p className="muted" style={{ marginTop: 8 }}>Visible&apos;s own data only. Nothing here reads or writes Ai Ads.</p>
        <div className="kpis">
          <div className="kpi"><b>{mode === "live" ? "Live" : mode === "demo" ? "Test" : "Off"}</b><span>AI checks ({measureModel()})</span></div>
          <div className="kpi"><b>${usage.spentUsd.toFixed(2)}</b><span>spent today of ${usage.budgetUsd.toFixed(2)}</span></div>
          <div className="kpi"><b>{usage.questions}</b><span>questions today of {usage.questionLimit}</span></div>
          <div className="kpi"><b>{tracked?.length || 0}</b><span>saved businesses</span></div>
        </div>
        <div className="card">
          <h2>Safeguards</h2>
          <ul className="checklist">
            <li>Max {HARD_MAX_QUESTIONS} questions per check, one AI call per question, one question at a time.</li>
            <li>One official check per business per day. Sample (test) checks never count.</li>
            <li>Free checks: {freeRoundsPerIp()} per visitor per day, {freeRoundsPerDay()} per day in total.</li>
            <li>Worst-case cost per question reserved before each call: ${maxCostPerQuestion().toFixed(4)}.</li>
            <li>Storage: {storageMode()}. Billing: {billingEnabled() ? "on" : "not set up"}.</li>
          </ul>
        </div>
        <div className="card">
          <h2>Audit log</h2>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Time (UTC)</th><th>Event</th><th>By</th><th>Detail</th></tr></thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{e.at.replace("T", " ").slice(0, 19)}</td>
                    <td>{e.event}</td>
                    <td>{e.actor.slice(0, 10)}</td>
                    <td style={{ color: "var(--graphite)" }}>{e.detail ? Object.entries(e.detail).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
