import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getRound, getScan, saveScan } from "@/lib/scans";
import { AgentError } from "@/lib/agents";
import { PageError, draftPage, pagesAllowed } from "@/lib/pages";
import { lockRound, unlockRound } from "@/lib/guard";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };
const Input = z.object({ questionId: z.string().min(1).max(40) });

/** Writes the page that answers one lost question. One explicit click by the owner of a Growth/Pro account. */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id } = await params;
  const user = await currentUser();
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  if (!user || !pagesAllowed(user, scan)) return fail("Pages that win are part of the Growth plan.", 402);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  // Shares the lock with the agents: one AI job per business at a time.
  const lock = `agents:${scan.id}`;
  if (!(await lockRound(lock))) return fail("An agent is already working on this business. Try again in a minute.", 409);
  try {
    const rounds = await Promise.all([scan.viewRoundId, scan.lastRoundId].filter((x): x is string => !!x).map((r) => getRound(r)));
    const winPages = await draftPage(scan, user, parsed.data.questionId, rounds);
    const fresh = (await getScan(id))!;
    fresh.winPages = winPages;
    await saveScan(fresh);
    return NextResponse.json({ ok: true, pageId: winPages.find((p) => p.questionId === parsed.data.questionId)?.id });
  } catch (e) {
    if (e instanceof PageError || e instanceof AgentError) return fail(e.message, 409);
    console.error("page draft failed", String((e as Error)?.message || e).slice(0, 200));
    return fail("The page agent stopped. Try again in a minute.", 502);
  } finally {
    await unlockRound(lock);
  }
}
