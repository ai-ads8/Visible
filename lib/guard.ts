import "server-only";
import { kvGet, kvIncr, kvSetNx, kvDel, today } from "./store";
import { maxCostPerQuestion } from "./engine/ai";

/*
 * Every safeguard around paid AI calls lives here, enforced on the server:
 *  - live calls only when OPENAI_API_KEY is set AND VISIBLE_LIVE_MEASUREMENTS=on (explicit owner approval);
 *  - at most 20 questions per round (hard cap, cannot be raised by env);
 *  - exactly one model call per question, one question at a time per round (a lock makes rounds sequential);
 *  - one official round per business per day;
 *  - a daily spend budget and a daily question cap for the whole app, reserved BEFORE each call;
 *  - free rounds limited per visitor/IP per day;
 *  - demo (sample) rounds only outside production unless VISIBLE_DEMO=on, and they never count as results.
 */

export const HARD_MAX_QUESTIONS = 20;

export const liveEnabled = () => !!process.env.OPENAI_API_KEY && process.env.VISIBLE_LIVE_MEASUREMENTS === "on";
export const demoEnabled = () => !liveEnabled() && (process.env.NODE_ENV !== "production" || process.env.VISIBLE_DEMO === "on");
export const measureMode = (): "live" | "demo" | "off" => (liveEnabled() ? "live" : demoEnabled() ? "demo" : "off");

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const dailyBudgetUsd = () => num(process.env.DAILY_BUDGET_USD, 3);
export const dailyQuestionLimit = () => num(process.env.DAILY_QUESTION_LIMIT, 150);
export const freeRoundsPerIp = () => num(process.env.FREE_ROUNDS_PER_IP, 2);
export const freeRoundsPerDay = () => num(process.env.FREE_ROUNDS_PER_DAY, 40);
export const clampQuestions = (n: number) => Math.max(1, Math.min(HARD_MAX_QUESTIONS, Math.floor(n)));

const DAY = 86400 * 2;

/** One official round per business per day. Returns false when today's round already exists. */
export async function claimDailyRound(scanId: string, roundId: string): Promise<boolean> {
  return kvSetNx(`round-day:${scanId}:${today()}`, roundId, DAY);
}
export const todaysRoundId = (scanId: string) => kvGet<string>(`round-day:${scanId}:${today()}`);

/** Free rounds: per IP and for the whole app per day. */
export async function allowFreeRound(ipHash: string): Promise<string | null> {
  if ((await kvIncr(`free-ip:${ipHash}:${today()}`, 1, DAY)) > freeRoundsPerIp()) return "You've used today's free AI checks. Create an account to keep tracking.";
  if ((await kvIncr(`free-all:${today()}`, 1, DAY)) > freeRoundsPerDay()) return "Free AI checks are fully booked for today. Try again tomorrow, or create an account.";
  return null;
}

/**
 * Reserves a worst-case cost against today's budget (and, for customer questions, the daily question cap) BEFORE a
 * paid call. Returns a settle function that books the real cost afterwards, or null when the limit is reached
 * (no call may be made then).
 */
export async function reserveSpend(maxUsd: number, countsAsQuestion = false): Promise<null | ((actualUsd: number) => Promise<void>)> {
  const spent = await kvIncr(`spend:${today()}`, maxUsd, DAY);
  const count = countsAsQuestion ? await kvIncr(`questions:${today()}`, 1, DAY) : 0;
  if (spent > dailyBudgetUsd() || count > dailyQuestionLimit()) {
    await kvIncr(`spend:${today()}`, -maxUsd, DAY);
    if (countsAsQuestion) await kvIncr(`questions:${today()}`, -1, DAY);
    return null;
  }
  return async (actual: number) => {
    await kvIncr(`spend:${today()}`, actual - maxUsd, DAY);
  };
}

export const reserveQuestion = () => reserveSpend(maxCostPerQuestion(), true);

export async function usageToday() {
  return {
    spentUsd: Math.max(0, Number((await kvGet<number>(`spend:${today()}`)) || 0)),
    questions: Number((await kvGet<number>(`questions:${today()}`)) || 0),
    budgetUsd: dailyBudgetUsd(),
    questionLimit: dailyQuestionLimit(),
  };
}

/** Sequential execution: only one question of a round is in flight at any time. */
export async function lockRound(roundId: string) {
  return kvSetNx(`round-lock:${roundId}`, "1", 70);
}
export const unlockRound = (roundId: string) => kvDel(`round-lock:${roundId}`);
