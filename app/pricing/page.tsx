import type { Metadata } from "next";
import { PlanCards } from "@/components/PlanCards";
import { currentUser } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing";

export const metadata: Metadata = { title: "Pricing", description: "Start with a free AI visibility scan. Plans from €19/month to track it." };

export default async function Pricing() {
  const user = await currentUser().catch(() => null);
  return (
    <section className="page">
      <div className="wrap">
        <div className="section-head">
          <h1>Simple pricing</h1>
          <p>Start with a free scan. Pick a plan when you want every answer, all competitors and regular checks. Prices in euros; cancel any time.</p>
        </div>
        {!billingEnabled() && <p className="notice info" style={{ marginBottom: 20 }}>Paid plans open soon. The free scan works today.</p>}
        <PlanCards current={user?.plan} />
      </div>
    </section>
  );
}
