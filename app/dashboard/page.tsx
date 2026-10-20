import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { getScan } from "@/lib/scans";
import { PLANS, isPaid } from "@/lib/plans";
import { ManageBilling } from "@/components/ManageBilling";
import { TrendChart } from "@/components/TrendChart";
import type { Scan } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const { upgraded } = await searchParams;
  const scans = (await Promise.all(user.scanIds.map((id) => getScan(id)))).filter((s): s is Scan => !!s);
  const plan = PLANS[user.plan];

  return (
    <section className="page">
      <div className="wrap" style={{ maxWidth: 860 }}>
        {upgraded && <p className="notice info" style={{ marginBottom: 20 }}>Thanks! Your plan is being activated; this can take a few seconds. Refresh if you still see the free plan.</p>}
        <h1>Your businesses</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {plan.name} plan{isPaid(user.plan) ? `, ${plan.questions} questions per check, checked ${plan.cadence}` : ""}. {user.email}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {scans.length < plan.businesses || !isPaid(user.plan) ? <a className="btn small" href="/#scan">Scan a website</a> : null}
          {isPaid(user.plan) ? <ManageBilling /> : <a className="btn quiet small" href="/pricing">Upgrade</a>}
          {isAdmin(user) && <a className="btn quiet small" href="/admin">Admin</a>}
          <form action="/api/auth/signout" method="post"><button className="btn quiet small">Sign out</button></form>
        </div>

        <div className="biz">
          {scans.length === 0 && (
            <div className="card">
              <h2>No businesses yet</h2>
              <p className="sub">Scan your website to see if AI recommends you.</p>
              <p style={{ marginTop: 16 }}><a className="btn" href="/#scan">Scan my website</a></p>
            </div>
          )}
          {scans.map((s) => {
            const last = s.history.at(-1);
            return (
              <div key={s.id}>
                <a className="row" href={`/scan/${s.id}`}>
                  <span>
                    <strong>{s.profile.name}</strong>
                    <span className="muted small" style={{ display: "block" }}>{s.profile.domain}{last ? `, last checked ${last.date.slice(0, 10)}` : ", not checked by AI yet"}</span>
                  </span>
                  <span className="stat">
                    {last ? `${last.named}/${last.total}` : `${s.readiness.score}`}
                    <small>{last ? "named by AI" : "readiness"}</small>
                  </span>
                </a>
                {isPaid(user.plan) && <TrendChart history={s.history} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
