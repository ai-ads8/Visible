import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getScan, saveScan } from "@/lib/scans";
import { PageEdit, PageError, applyEdit, pagesAllowed } from "@/lib/pages";
import { audit } from "@/lib/audit";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; pageId: string }> };

async function owned(id: string) {
  const user = await currentUser();
  const scan = await getScan(id);
  if (!scan) return { res: fail("Scan not found.", 404) } as const;
  if (!user || !pagesAllowed(user, scan)) return { res: fail("Pages that win are part of the Growth plan.", 402) } as const;
  return { user, scan } as const;
}

/** Saves the owner's edits, or approves / un-approves the page. No AI call. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id, pageId } = await params;
  const o = await owned(id);
  if ("res" in o) return o.res;
  const parsed = await body(req, PageEdit);
  if (!parsed.ok) return parsed.res;
  try {
    o.scan.winPages = applyEdit(o.scan, pageId, parsed.data);
    await saveScan(o.scan);
    if (parsed.data.status) await audit(`page.${parsed.data.status}`, o.user.id, { scan: id, page: pageId });
    return NextResponse.json({ ok: true, page: o.scan.winPages.find((p) => p.id === pageId) });
  } catch (e) {
    if (e instanceof PageError) return fail(e.message, 400);
    throw e;
  }
}

/** Removes a page from Visible. A page already on the website stays there; the owner removes it in their CMS. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id, pageId } = await params;
  const o = await owned(id);
  if ("res" in o) return o.res;
  o.scan.winPages = (o.scan.winPages || []).filter((p) => p.id !== pageId);
  await saveScan(o.scan);
  await audit("page.delete", o.user.id, { scan: id, page: pageId });
  return NextResponse.json({ ok: true });
}
