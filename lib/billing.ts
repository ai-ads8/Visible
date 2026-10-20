import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getUser, saveUser, type User } from "./auth";
import { kvGet, kvSet } from "./store";
import { audit } from "./audit";
import { PAID, type PlanId } from "./plans";

/*
 * Stripe Checkout + Customer Portal over Stripe's REST API (no SDK). Visible's own Stripe account and prices;
 * nothing is shared with Ai Ads' invoicing. Without STRIPE_SECRET_KEY the upgrade buttons say billing isn't set up.
 */

const priceEnv: Record<Exclude<PlanId, "free">, string> = { starter: "STRIPE_PRICE_STARTER", growth: "STRIPE_PRICE_GROWTH", pro: "STRIPE_PRICE_PRO" };
export const priceId = (plan: PlanId) => (plan === "free" ? "" : process.env[priceEnv[plan]] || "");
export const billingEnabled = () => !!process.env.STRIPE_SECRET_KEY && PAID.some((p) => !!priceId(p));

async function stripe(path: string, form: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json.error?.message || ""}`);
  return json;
}

export async function checkoutUrl(user: User, plan: PlanId, origin: string): Promise<string> {
  const price = priceId(plan);
  if (!price) throw new Error("no price for plan");
  const form: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    client_reference_id: user.id,
    allow_promotion_codes: "true",
    "metadata[plan]": plan,
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][user]": user.id,
  };
  if (user.stripeCustomerId) form.customer = user.stripeCustomerId;
  else form.customer_email = user.email;
  return (await stripe("checkout/sessions", form)).url!;
}

export async function portalUrl(user: User, origin: string): Promise<string> {
  if (!user.stripeCustomerId) throw new Error("no customer");
  return (await stripe("billing_portal/sessions", { customer: user.stripeCustomerId, return_url: `${origin}/dashboard` })).url!;
}

/** Verifies Stripe's signature header (t=…,v1=…) over the raw body, with a 5-minute tolerance. */
export function verifyStripe(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const got = p.slice(3);
      return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
    });
}

type StripeObj = { id: string; customer?: string; client_reference_id?: string; status?: string; metadata?: Record<string, string> };

export async function handleStripeEvent(evt: { id: string; type: string; data: { object: StripeObj } }) {
  // Each event is processed once.
  if (await kvGet(`stripe-evt:${evt.id}`)) return;
  await kvSet(`stripe-evt:${evt.id}`, 1, 60 * 60 * 24 * 30);
  const o = evt.data.object;
  const asPlan = (p?: string): PlanId => (PAID.includes(p as PlanId) ? (p as PlanId) : "free");

  if (evt.type === "checkout.session.completed" && o.client_reference_id) {
    const user = await getUser(o.client_reference_id);
    if (!user) return;
    user.plan = asPlan(o.metadata?.plan);
    user.subscriptionStatus = "active";
    if (o.customer) {
      user.stripeCustomerId = o.customer;
      await kvSet(`stripe-customer:${o.customer}`, user.id);
    }
    await saveUser(user);
    await audit("plan.changed", user.id, { plan: user.plan, via: "checkout" });
    return;
  }
  if ((evt.type === "customer.subscription.updated" || evt.type === "customer.subscription.deleted") && o.customer) {
    const uid = (await kvGet<string>(`stripe-customer:${o.customer}`)) || o.metadata?.user;
    const user = uid ? await getUser(uid) : null;
    if (!user) return;
    const active = evt.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(o.status || "");
    user.plan = active ? asPlan(o.metadata?.plan) : "free";
    user.subscriptionStatus = o.status;
    await saveUser(user);
    await audit("plan.changed", user.id, { plan: user.plan, status: o.status, via: evt.type });
  }
}
