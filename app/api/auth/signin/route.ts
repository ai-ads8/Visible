import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPassword, clientIpHash, startSession, userByEmail } from "@/lib/auth";
import { hit } from "@/lib/store";
import { audit } from "@/lib/audit";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

const Input = z.object({ email: z.string().trim().max(120), password: z.string().max(200) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const ip = clientIpHash(req);
  if ((await hit(`signin:${ip}`, 900)) > 10) return fail("Too many attempts. Try again in 15 minutes.", 429);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  const user = await userByEmail(parsed.data.email);
  if (!user || !(await checkPassword(parsed.data.password, user.pwHash))) {
    await audit("signin.failed", "visitor");
    return fail("Email or password is incorrect.", 401);
  }
  await startSession(user.id);
  await audit("signin", user.id);
  return NextResponse.json({ ok: true });
}
