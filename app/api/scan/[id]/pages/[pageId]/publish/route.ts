import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getScan, saveScan } from "@/lib/scans";
import { pagesAllowed } from "@/lib/pages";
import { openPlaceholders, pageHtml } from "@/lib/pagekit";
import { CmsError, loadCredentials, upsertPage } from "@/lib/cms";
import { audit } from "@/lib/audit";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; pageId: string }> };
const Input = z.object({ live: z.boolean() });

/**
 * Puts an approved page on the owner's website: live, or as a draft to check there first. Only approved pages
 * (no open placeholders, not a sample) can be published. Publishing again updates the same page.
 */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id, pageId } = await params;
  const user = await currentUser();
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  if (!user || !pagesAllowed(user, scan)) return fail("Pages that win are part of the Growth plan.", 402);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  const page = (scan.winPages || []).find((p) => p.id === pageId);
  if (!page) return fail("Page not found.", 404);
  if (page.sample) return fail("This is a sample page from test mode and can't be published.");
  if (openPlaceholders(page).length) return fail("Fill in the open points before publishing.");
  if (page.status === "draft") return fail("Approve the page before publishing it.");
  const cred = await loadCredentials(id);
  if (!cred || !scan.cms) return fail("Connect your website first.");
  try {
    const res = await upsertPage(cred, { remoteId: page.published?.remoteId, title: page.title, slug: page.slug, html: pageHtml(page), excerpt: page.meta, live: parsed.data.live });
    const now = new Date().toISOString();
    const next = { ...page, status: (res.live ? "published" : "approved") as typeof page.status, updatedAt: now, published: { platform: cred.platform, url: res.url, remoteId: res.remoteId, at: now, live: res.live } };
    scan.winPages = (scan.winPages || []).map((p) => (p.id === page.id ? next : p));
    await saveScan(scan);
    await audit("page.publish", user.id, { scan: id, page: pageId, live: res.live, platform: cred.platform });
    return NextResponse.json({ ok: true, page: next });
  } catch (e) {
    if (e instanceof CmsError) return fail(e.message, 400);
    console.error("page publish failed", String((e as Error)?.message || e).slice(0, 200));
    return fail("Publishing didn't work. Try again in a minute.", 502);
  }
}
