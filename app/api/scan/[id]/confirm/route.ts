import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, visitorHash } from "@/lib/auth";
import { canControl, getScan, saveScan } from "@/lib/scans";
import { buildQuestions } from "@/lib/engine/questions";
import { summarize } from "@/lib/engine/readiness";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({
  name: z.string().trim().min(2, "Enter your business name.").max(80),
  category: z.string().trim().min(2, "Tell us what kind of business you are.").max(60),
  service: z.string().trim().max(60).default(""),
  city: z.string().trim().max(60).default(""),
  country: z.string().trim().length(2, "Choose your country.").toUpperCase(),
  reach: z.enum(["local", "online"]),
});

/** The owner confirms or corrects what the scan guessed. The questions are rebuilt from the confirmed details. */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  if (!canControl(scan, await currentUser(), await visitorHash())) return fail("Only the person who ran this scan can change it.", 403);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  if (parsed.data.reach === "local" && !parsed.data.city) return fail("Enter the city you serve.");
  // Changing details after official checks would make the trend meaningless; the history keeps old rounds as they were.
  scan.profile = { ...scan.profile, ...parsed.data, confirmed: true };
  scan.questions = buildQuestions(scan.profile);
  // Location and opening hours only matter for local businesses.
  if (scan.profile.reach === "online") scan.readiness = summarize(scan.readiness.checks.filter((c) => c.id !== "location" && c.id !== "hours"), scan.readiness.pagesRead);
  await saveScan(scan);
  return NextResponse.json({ ok: true });
}
