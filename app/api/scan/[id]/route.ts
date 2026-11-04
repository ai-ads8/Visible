import { NextResponse } from "next/server";
import { currentUser, visitorHash } from "@/lib/auth";
import { canControl, getRound, getScan } from "@/lib/scans";
import { scanView } from "@/lib/view";
import { fail } from "@/lib/http";
import { pagesAllowed, pagesUsed } from "@/lib/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The scan as the current viewer may see it (locked parts are left out on the server). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  const user = await currentUser();
  const control = canControl(scan, user, await visitorHash());
  // A saved scan is private to its account.
  if (scan.ownerId && !control) return fail("This scan is private.", 403);
  const round = scan.viewRoundId ? await getRound(scan.viewRoundId) : null;
  // The official check before the one on screen, for "new win" / "lost since last check".
  const i = scan.history.findIndex((h) => h.roundId === round?.id);
  const prevId = i > 0 ? scan.history[i - 1].roundId : i < 0 ? scan.history.at(-1)?.roundId : undefined;
  const prev = prevId && prevId !== round?.id ? await getRound(prevId) : null;
  const used = pagesAllowed(user, scan) ? await pagesUsed(scan.id) : 0;
  return NextResponse.json(scanView(scan, round, { user, control, prev, pagesUsed: used }), { headers: { "cache-control": "no-store" } });
}
