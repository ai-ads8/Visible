import { NextResponse } from "next/server";
import { z } from "zod";
import { crawl } from "@/lib/engine/crawl";
import { normalizeInputUrl, ScanError } from "@/lib/engine/fetch";
import { guessProfile } from "@/lib/engine/profile";
import { buildReadiness } from "@/lib/engine/readiness";
import { buildQuestions } from "@/lib/engine/questions";
import { clientIpHash, currentUser, visitorHash } from "@/lib/auth";
import { newScanId, saveScan } from "@/lib/scans";
import { hit, today } from "@/lib/store";
import { audit } from "@/lib/audit";
import { body, fail, sameOrigin } from "@/lib/http";
import type { Scan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Input = z.object({ url: z.string().trim().min(3, "Enter your website.").max(200) });

/** The free website scan: reads the site, no AI and no paid API (€0). Rate limited per visitor and per day. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const ip = clientIpHash(req);
  if ((await hit(`scan-ip:${ip}`, 600)) > 6) return fail("You've run a few scans in a row. Try again in ten minutes.", 429);
  if ((await hit(`scan-day:${today()}`, 86400)) > Number(process.env.DAILY_SCAN_LIMIT || 1000)) return fail("We're very busy today. Please try again tomorrow.", 429);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;

  try {
    const url = normalizeInputUrl(parsed.data.url);
    const result = await crawl(url);
    const country = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
    const profile = guessProfile(result, country);
    const readiness = buildReadiness(result, profile);
    const user = await currentUser();
    const scan: Scan = {
      id: newScanId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile,
      readiness,
      questions: buildQuestions(profile),
      history: [],
      visitorHash: (await visitorHash(true))!,
      ownerId: undefined,
    };
    await saveScan(scan);
    await audit("scan.created", user?.id || "visitor", { scan: scan.id, domain: profile.domain, pages: readiness.pagesRead });
    return NextResponse.json({ id: scan.id });
  } catch (e) {
    if (e instanceof ScanError) return fail(e.userMessage, 422);
    console.error("scan failed", e);
    return fail("We couldn't read your website right now. Check the address and try again.", 502);
  }
}
