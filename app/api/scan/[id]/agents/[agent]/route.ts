import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getScan, saveScan } from "@/lib/scans";
import { AgentError, agentsAllowed, runAgent, type AgentId } from "@/lib/agents";
import { lockRound, unlockRound } from "@/lib/guard";
import { body, fail, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string; agent: string }> };
const Input = z.object({ keyword: z.string().trim().min(2).max(80).optional() });

/** Runs one agent once, on an explicit click by the owner of a Growth/Pro account (or an admin). */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  const { id, agent } = await params;
  if (!["geo", "seo", "social"].includes(agent)) return fail("Unknown agent.", 404);
  const user = await currentUser();
  const scan = await getScan(id);
  if (!scan) return fail("Scan not found.", 404);
  if (!user || !agentsAllowed(user, scan)) return fail("The agents are part of the Growth plan.", 402);
  const parsed = await body(req, Input);
  if (!parsed.ok) return parsed.res;
  // One agent run per business at a time.
  const lock = `agents:${scan.id}`;
  if (!(await lockRound(lock))) return fail("An agent is already working on this business.", 409);
  try {
    const agents = await runAgent(scan, user, agent as AgentId, { keyword: parsed.data.keyword });
    const fresh = (await getScan(id))!;
    fresh.agents = agents;
    await saveScan(fresh);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AgentError) return fail(e.message, 409);
    console.error("agent failed", agent, String((e as Error)?.message || e).slice(0, 200));
    return fail("The agent stopped. Try again in a minute.", 502);
  } finally {
    await unlockRound(lock);
  }
}
