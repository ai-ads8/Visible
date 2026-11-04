import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getScan, saveScan } from "@/lib/scans";
import { pagesAllowed } from "@/lib/pages";
import { CmsError, cmsEnabled, deleteCredentials, normalizeSite, saveCredentials, testConnection, type CmsCredentials } from "@/lib/cms";
import { audit } from "@/lib/audit";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const Input = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("wordpress"), site: z.string().trim().min(3).max(200), user: z.string().trim().min(1, "Enter your WordPress username.").max(120), secret: z.string().trim().min(8, "Paste the application password.").max(200) }),
  z.object({ platform: z.literal("shopify"), site: z.string().trim().min(3).max(200), clientId: z.string().trim().max(200).optional(), secret: z.string().trim().min(8, "Paste the secret or access token.").max(300) }),
]);

async function owned(id: string) {
  const user = await currentUser();
  const scan = await getScan(id);
  if (!scan) return { res: fail("Scan not found.", 404) } as const;
  if (!user || !pagesAllowed(user, scan)) return { res: fail("Publishing is part of the Growth plan.", 402) } as const;
  return { user, scan } as const;
}

/** Tests the login on the owner's website and, when it works, saves it encrypted. */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  if (!cmsEnabled()) return fail("Publishing to websites isn't switched on yet.", 503);
  const { id } = await params;
  const o = await owned(id);
  if ("res" in o) return o.res;
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  try {
    const d = parsed.data;
    const cred: CmsCredentials = d.platform === "wordpress" ? { platform: "wordpress", site: normalizeSite("wordpress", d.site), user: d.user, secret: d.secret } : { platform: "shopify", site: normalizeSite("shopify", d.site), clientId: d.clientId || undefined, secret: d.secret };
    const account = await testConnection(cred);
    await saveCredentials(id, cred);
    o.scan.cms = { platform: cred.platform, site: cred.site, account, connectedAt: new Date().toISOString() };
    await saveScan(o.scan);
    await audit("cms.connect", o.user.id, { scan: id, platform: cred.platform });
    return NextResponse.json({ ok: true, cms: o.scan.cms });
  } catch (e) {
    if (e instanceof CmsError) return fail(e.message, 400);
    console.error("cms connect failed", String((e as Error)?.message || e).slice(0, 200));
    return fail("Connecting didn't work. Try again in a minute.", 502);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id } = await params;
  const o = await owned(id);
  if ("res" in o) return o.res;
  await deleteCredentials(id);
  o.scan.cms = undefined;
  await saveScan(o.scan);
  await audit("cms.disconnect", o.user.id, { scan: id });
  return NextResponse.json({ ok: true });
}
