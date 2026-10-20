import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { billingEnabled, checkoutUrl, priceId } from "@/lib/billing";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

const Input = z.object({ plan: z.enum(["starter", "growth", "pro"]) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const user = await currentUser();
  if (!user) return fail("Create an account or sign in first.", 401);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  if (!billingEnabled() || !priceId(parsed.data.plan)) return fail("Payments aren't set up yet.", 503);
  try {
    return NextResponse.json({ url: await checkoutUrl(user, parsed.data.plan, new URL(req.url).origin) });
  } catch (e) {
    console.error("checkout failed", String(e).slice(0, 200));
    return fail("Checkout couldn't open. Try again.", 502);
  }
}
