import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runScheduled } from "@/lib/schedule";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Only the scheduler that sends `Authorization: Bearer <CRON_SECRET>` may run this. Fails closed without a secret. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const got = req.headers.get("authorization") || "";
  const want = `Bearer ${secret}`;
  if (secret.length < 32 || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runScheduled(45_000));
}
