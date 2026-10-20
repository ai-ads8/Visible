import { NextResponse } from "next/server";
import { handleStripeEvent, verifyStripe } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const payload = await req.text();
  if (!verifyStripe(payload, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  try {
    await handleStripeEvent(JSON.parse(payload));
  } catch (e) {
    console.error("stripe webhook failed", String(e).slice(0, 200));
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
