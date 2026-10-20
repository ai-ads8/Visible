import "server-only";
import { createHash } from "node:crypto";
import { audit } from "./audit";
import { newId, type User } from "./auth";
import { askLikeCustomer, sampleAnswer, measureModel, type Asked } from "./engine/ai";
import { detectMention } from "./engine/mentions";
import { allowFreeRound, claimDailyRound, clampQuestions, lockRound, measureMode, reserveQuestion, todaysRoundId, unlockRound } from "./guard";
import { PLANS, isPaid } from "./plans";
import { getRound, getScan, saveRound, saveScan } from "./scans";
import { kvGet, kvSet } from "./store";
import type { AnswerRecord, Round, Scan } from "./types";

/*
 * A measurement round: the scan's questions, asked one by one. The browser (or the scheduler) calls advanceRound()
 * repeatedly; each call asks at most ONE question, under a lock, so a round always runs sequentially and a page
 * refresh or a double click can never trigger extra paid calls.
 */

export class RoundError extends Error {}

const ANSWER_CACHE_DAYS = () => Number(process.env.ANSWER_CACHE_DAYS || 7);

export async function startRound(scan: Scan, who: { user: User | null; ipHash: string; trigger: Round["triggeredBy"] }): Promise<Round> {
  const mode = measureMode();
  if (mode === "off") throw new RoundError("The AI check isn't switched on yet. Your website check above is complete and free.");
  if (!scan.profile.confirmed) throw new RoundError("Confirm your business details first.");

  const plan = who.user && scan.ownerId === who.user.id ? PLANS[who.user.plan] : PLANS.free;
  const count = clampQuestions(Math.min(plan.questions, scan.questions.length));

  if (mode === "live") {
    // Resume today's round instead of starting another one.
    const existing = await todaysRoundId(scan.id);
    if (existing) {
      const r = await getRound(existing);
      if (r) return r;
    }
    const last = scan.history.at(-1);
    if (last) {
      const days = (Date.now() - new Date(last.date).getTime()) / 86400000;
      if (plan.cadence === "once") throw new RoundError("Your free check is done. Upgrade to track your visibility over time.");
      if (plan.cadence === "weekly" && days < 7) throw new RoundError(`Your next weekly check is available in ${Math.ceil(7 - days)} day(s).`);
    }
    if (!isPaid(who.user?.plan)) {
      const refused = await allowFreeRound(who.ipHash);
      if (refused) {
        await audit("round.refused", who.user?.id || "visitor", { scan: scan.id, reason: "free limit" });
        throw new RoundError(refused);
      }
    }
  }

  const round: Round = {
    id: newId(10),
    scanId: scan.id,
    startedAt: new Date().toISOString(),
    status: "running",
    kind: mode === "live" ? "official" : "demo",
    questionIds: scan.questions.slice(0, count).map((q) => q.id),
    answers: [],
    costUsd: 0,
    triggeredBy: who.trigger,
  };
  if (mode === "live" && !(await claimDailyRound(scan.id, round.id))) {
    const r = await getRound((await todaysRoundId(scan.id)) || "");
    if (r) return r;
    throw new RoundError("Today's check already ran.");
  }
  await saveRound(round);
  scan.viewRoundId = round.id;
  await saveScan(scan);
  await audit("round.start", who.user?.id || "visitor", { scan: scan.id, round: round.id, kind: round.kind, questions: count, trigger: who.trigger });
  return round;
}

async function ask(scan: Scan, question: string, index: number): Promise<Asked & { cached: boolean }> {
  if (measureMode() !== "live") return { ...sampleAnswer(question, scan.profile, scan.profile.name, index), cached: false };
  const key = `answer:${createHash("sha256").update([measureModel(), scan.profile.country, scan.profile.city.toLowerCase(), question.toLowerCase()].join("|")).digest("hex")}`;
  const hit = await kvGet<Asked>(key);
  if (hit) return { ...hit, costUsd: 0, cached: true };
  const settle = await reserveQuestion();
  if (!settle) throw new RoundError("Today's AI budget is used up. Your check will continue tomorrow.");
  let asked: Asked;
  try {
    asked = await askLikeCustomer(question, { country: scan.profile.country, city: scan.profile.city });
  } catch (e) {
    await settle(0);
    throw e;
  }
  await settle(asked.costUsd);
  await kvSet(key, asked, ANSWER_CACHE_DAYS() * 86400);
  return { ...asked, cached: false };
}

export async function advanceRound(roundId: string): Promise<Round> {
  let round = await getRound(roundId);
  if (!round) throw new RoundError("Check not found.");
  if (round.status !== "running") return round;
  if (!(await lockRound(roundId))) return round; // another question of this round is in flight
  try {
    round = (await getRound(roundId))!;
    const scan = await getScan(round.scanId);
    if (!scan) throw new RoundError("Scan not found.");
    const qid = round.questionIds[round.answers.length];
    const q = scan.questions.find((x) => x.id === qid);
    if (q) {
      try {
        const a = await ask(scan, q.text, round.answers.length);
        const m = detectMention({ name: scan.profile.name, domain: scan.profile.domain }, a);
        const rec: AnswerRecord = {
          questionId: q.id,
          question: q.text,
          text: a.text,
          sources: a.sources,
          businesses: a.businesses,
          mention: m.mention,
          position: m.position,
          askedAt: new Date().toISOString(),
          model: a.model,
          costUsd: Math.round(a.costUsd * 10000) / 10000,
          cached: a.cached,
        };
        round.answers.push(rec);
        round.costUsd = Math.round((round.costUsd + rec.costUsd) * 10000) / 10000;
        round.error = undefined;
        if (round.kind === "official") await audit("question.asked", "system", { round: round.id, q: q.id, cached: a.cached, cost: rec.costUsd });
      } catch (e) {
        const msg = e instanceof RoundError ? e.message : /429|rate/i.test(String(e)) ? "AI is busy. Trying again in a moment." : "This question couldn't be checked right now.";
        round.error = msg;
        console.error("question failed", round.id, String((e as Error)?.message || e).slice(0, 200));
        await audit("question.failed", "system", { round: round.id, q: qid, reason: msg });
        // A budget stop pauses the round; anything else skips the question so a round always finishes.
        if (e instanceof RoundError) {
          await saveRound(round);
          return round;
        }
        round.questionIds = round.questionIds.filter((x) => x !== qid);
      }
    } else {
      round.questionIds = round.questionIds.filter((x) => x !== qid);
    }
    if (round.answers.length >= round.questionIds.length) {
      round.status = "done";
      round.finishedAt = new Date().toISOString();
      if (round.kind === "official") {
        scan.lastRoundId = round.id;
        scan.history = [
          ...scan.history.filter((h) => h.roundId !== round!.id),
          { roundId: round.id, date: round.finishedAt, named: round.answers.filter((a) => a.mention === "named").length, total: round.answers.length, readiness: scan.readiness.score },
        ].slice(-365);
        await saveScan(scan);
      }
      await audit("round.done", "system", { round: round.id, kind: round.kind, cost: round.costUsd });
    }
    await saveRound(round);
    return round;
  } finally {
    await unlockRound(roundId);
  }
}
