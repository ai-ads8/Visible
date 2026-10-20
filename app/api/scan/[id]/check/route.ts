import { NextResponse } from "next/server";
import { clientIpHash, currentUser, visitorHash } from "@/lib/auth";
import { canControl, getScan } from "@/lib/scans";
import { RoundError, startRound } from "@/lib/rounds";
import { fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Starts (or resumes today's) AI check. Never asks a question itself: the browser advances it one question at a time. */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  const user = await currentUser();
  if (!canControl(scan, user, await visitorHash())) return fail("Only the person who ran this scan can start the AI check.", 403);
  try {
    const round = await startRound(scan, { user, ipHash: clientIpHash(req), trigger: user ? "account" : "visitor" });
    return NextResponse.json({ roundId: round.id });
  } catch (e) {
    if (e instanceof RoundError) return fail(e.message, 409);
    console.error("round start failed", e);
    return fail("The AI check couldn't start. Try again in a minute.", 500);
  }
}
