import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { portalUrl } from "@/lib/billing";
import { fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const user = await currentUser();
  if (!user?.stripeCustomerId) return fail("No subscription found.", 404);
  try {
    return NextResponse.json({ url: await portalUrl(user, new URL(req.url).origin) });
  } catch {
    return fail("Billing settings couldn't open. Try again.", 502);
  }
}
