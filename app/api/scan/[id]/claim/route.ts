import { NextResponse } from "next/server";
import { currentUser, saveUser, visitorHash } from "@/lib/auth";
import { getScan, saveScan } from "@/lib/scans";
import { PLANS } from "@/lib/plans";
import { audit } from "@/lib/audit";
import { track } from "@/lib/schedule";
import { fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Saves an anonymous scan to the signed-in account (only the visitor who ran it can do this). */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id } = await params;
  const user = await currentUser();
  if (!user) return fail("Sign in first.", 401);
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  if (scan.ownerId === user.id) return NextResponse.json({ ok: true });
  if (scan.ownerId || scan.visitorHash !== (await visitorHash())) return fail("This scan belongs to someone else.", 403);
  const owned = user.scanIds.length;
  if (owned >= PLANS[user.plan].businesses && user.plan !== "free") return fail(`Your plan includes ${PLANS[user.plan].businesses} business(es). Upgrade to add more.`, 409);
  scan.ownerId = user.id;
  await saveScan(scan);
  user.scanIds = [scan.id, ...user.scanIds.filter((x) => x !== scan.id)].slice(0, 20);
  await saveUser(user);
  await track(scan.id);
  await audit("scan.claimed", user.id, { scan: scan.id });
  return NextResponse.json({ ok: true });
}
