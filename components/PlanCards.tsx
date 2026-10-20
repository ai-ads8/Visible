import { PLANS, type PlanId } from "@/lib/plans";
import { UpgradeButton } from "./UpgradeButton";

const cadence = { once: "One check", weekly: "Checked weekly", daily: "Checked daily" };

export function PlanCards({ current }: { current?: PlanId }) {
  return (
    <div className="plans">
      {(Object.keys(PLANS) as PlanId[]).map((id) => {
        const p = PLANS[id];
        return (
          <div key={id} className={`plan${id === "growth" ? " featured" : ""}`}>
            {id === "growth" && <span className="pill">Most popular</span>}
            <h3>{p.name}</h3>
            <div className="price">
              €{p.priceEur}
              {p.priceEur > 0 && <small> / month</small>}
            </div>
            <p className="muted small">{p.blurb} {cadence[p.cadence]}.</p>
            <ul>
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {id === "free" ? (
              <a className="btn quiet block" href="/#scan">Scan my website</a>
            ) : current === id ? (
              <span className="btn quiet block" aria-disabled="true">Your plan</span>
            ) : (
              <UpgradeButton plan={id} label={`Choose ${p.name}`} featured={id === "growth"} />
            )}
          </div>
        );
      })}
    </div>
  );
}
