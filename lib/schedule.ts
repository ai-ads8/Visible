import "server-only";
import { kvGet, kvSet } from "./store";
import { getUser } from "./auth";
import { getRound, getScan } from "./scans";
import { advanceRound, RoundError, startRound } from "./rounds";
import { PLANS, isPaid } from "./plans";
import { measureMode } from "./guard";
import { audit } from "./audit";

/*
 * Scheduled checks for paying accounts. The scheduler calls /api/cron/checks; each run starts the checks that are
 * due and asks questions one at a time until its time budget is used. Unfinished rounds continue on the next run.
 * Only live mode runs on a schedule: sample rounds are never scheduled.
 */

export async function track(scanId: string) {
  const list = (await kvGet<string[]>("tracked-scans")) || [];
  if (!list.includes(scanId)) await kvSet("tracked-scans", [...list, scanId].slice(-5000));
}

export async function runScheduled(budgetMs: number) {
  const started = Date.now();
  const report = { started: 0, asked: 0, skipped: 0 };
  if (measureMode() !== "live") return { ...report, note: "live measurements are off" };
  for (const id of (await kvGet<string[]>("tracked-scans")) || []) {
    if (Date.now() - started > budgetMs) break;
    const scan = await getScan(id);
    const user = scan?.ownerId ? await getUser(scan.ownerId) : null;
    if (!scan || !user || !isPaid(user.plan) || !scan.profile.confirmed) {
      report.skipped++;
      continue;
    }
    const last = scan.history.at(-1);
    const days = last ? (Date.now() - new Date(last.date).getTime()) / 86400000 : Infinity;
    const due = PLANS[user.plan].cadence === "daily" ? days >= 0.9 : days >= 6.9;
    let round = scan.viewRoundId ? await getRound(scan.viewRoundId) : null;
    if (!(round && round.status === "running" && round.kind === "official")) {
      if (!due) continue;
      try {
        round = await startRound(scan, { user, ipHash: "schedule", trigger: "schedule" });
        report.started++;
      } catch (e) {
        if (!(e instanceof RoundError)) console.error("scheduled start failed", id, e);
        continue;
      }
    }
    while (round && round.status === "running" && Date.now() - started < budgetMs) {
      const before = round.answers.length;
      round = await advanceRound(round.id);
      if (round.answers.length === before) break; // budget stop, lock or failure: try again next run
      report.asked++;
    }
  }
  await audit("schedule.run", "system", report);
  return report;
}
