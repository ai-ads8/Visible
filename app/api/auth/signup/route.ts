import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIpHash, createUser, saveUser, startSession, visitorHash } from "@/lib/auth";
import { getScan, saveScan } from "@/lib/scans";
import { hit } from "@/lib/store";
import { audit } from "@/lib/audit";
import { track } from "@/lib/schedule";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

const Input = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(120),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
  scanId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  if ((await hit(`signup:${clientIpHash(req)}`, 3600)) > 5) return fail("Too many sign-ups from here. Try again later.", 429);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  const user = await createUser(parsed.data.email, parsed.data.password);
  if (!user) return fail("There's already an account with this email. Sign in instead.", 409);
  // Save the scan the visitor just ran to the new account.
  if (parsed.data.scanId) {
    const scan = await getScan(parsed.data.scanId);
    if (scan && !scan.ownerId && scan.visitorHash === (await visitorHash())) {
      scan.ownerId = user.id;
      await saveScan(scan);
      user.scanIds = [scan.id];
      await saveUser(user);
      await track(scan.id);
    }
  }
  await startSession(user.id);
  await audit("account.created", user.id);
  return NextResponse.json({ ok: true });
}
