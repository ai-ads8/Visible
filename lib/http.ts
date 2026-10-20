import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  const r = schema.safeParse(await req.json().catch(() => ({})));
  if (!r.success) return { ok: false, res: fail(r.error.issues[0]?.message || "Invalid request.") };
  return { ok: true, data: r.data };
}

/** Rejects cross-site form posts to state-changing routes (the session cookie is SameSite=Lax, this is a second lock). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") || req.headers.get("host"));
  } catch {
    return false;
  }
}
