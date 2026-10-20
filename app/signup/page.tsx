import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default async function Signup({ searchParams }: { searchParams: Promise<{ scan?: string; plan?: string }> }) {
  const { scan, plan } = await searchParams;
  const p = plan && plan in PLANS ? PLANS[plan as PlanId] : null;
  return (
    <div className="narrow">
      <h1>{scan ? "Save your results" : "Create your account"}</h1>
      <p className="muted" style={{ marginTop: 10 }}>
        {p && p.id !== "free" ? `Then you'll go to checkout for ${p.name} (€${p.priceEur}/month).` : "Free. Keep your scan and come back to it any time."}
      </p>
      <AuthForm mode="signup" scanId={scan} plan={plan} />
      <p className="small muted" style={{ marginTop: 20 }}>
        Already have an account? <a href={`/signin${scan ? `?scan=${scan}` : ""}`}>Sign in</a>
      </p>
    </div>
  );
}
