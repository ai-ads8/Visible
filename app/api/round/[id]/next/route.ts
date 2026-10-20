import { NextResponse } from "next/server";
import { currentUser, visitorHash } from "@/lib/auth";
import { canControl, getRound, getScan } from "@/lib/scans";
import { advanceRound, RoundError } from "@/lib/rounds";
import { fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Asks the next question of a round (at most one per call, under a lock). */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id } = await params;
  const round = await getRound(id);
  if (!round) return fail("Check not found.", 404);
  const scan = await getScan(round.scanId);
  if (!scan || !canControl(scan, await currentUser(), await visitorHash())) return fail("Not allowed.", 403);
  try {
    const r = await advanceRound(id);
    return NextResponse.json({ status: r.status, done: r.answers.length, total: r.questionIds.length, error: r.error });
  } catch (e) {
    if (e instanceof RoundError) return fail(e.message, 409);
    console.error("advance failed", e);
    return fail("Something went wrong. Try again.", 500);
  }
}
