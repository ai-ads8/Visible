import "server-only";
import { isAdmin, type User } from "./auth";
import { agentsAllowed } from "./agents";
import { isPaid, PLANS } from "./plans";
import { measureMode } from "./guard";
import { topFixes } from "./engine/readiness";
import { competitorTable } from "./scans";
import { pageLimit, pagesAllowed } from "./pages";
import { cmsEnabled } from "./cms";
import { sameBusiness } from "./engine/mentions";
import type { AgentsState, CheckStatus, CmsLink, Mention, Round, Scan, WinPage } from "./types";

/*
 * What the browser may see of a scan. Locked parts are left out on the server (not just blurred with CSS), so the
 * paywall can't be bypassed by reading the page source. The free view still tells the owner the truth: the score,
 * which questions named them, who AI recommends instead, and the most important fixes.
 */

export const FREE_COMPETITORS = 3;
export const FREE_ANSWERS = 1;

export interface ScoreRow {
  id: string;
  /** Hidden on locked rows of the free scan. */
  text?: string;
  intent?: string;
  status: Mention | "pending";
  position?: number;
  /** Who AI named for this question (not you), first three. */
  rivals: string[];
  /** Status in the previous official check, when there is one. */
  was?: Mention;
  locked: boolean;
  page?: { id: string; status: WinPage["status"]; live: boolean; url?: string };
}

export interface ScanView {
  id: string;
  profile: Scan["profile"];
  readiness: { score: number; groups: Scan["readiness"]["groups"]; pagesRead: number };
  fixes: { id: string; label: string; status: CheckStatus; why: string; fix: string; evidence?: string }[];
  checklist: { id: string; group: string; label: string; status: CheckStatus; why?: string; fix?: string; evidence?: string }[];
  questions: { id: string; text: string; intent: string }[];
  round: null | {
    id: string;
    kind: Round["kind"];
    status: Round["status"];
    total: number;
    done: number;
    named: number;
    error?: string;
    finishedAt?: string;
    dots: { mention: Mention | "pending"; question?: string; locked: boolean }[];
    answers: { question: string; text: string; mention: Mention; position?: number; sources: string[]; businesses: string[]; cached: boolean; model: string }[];
    lockedAnswers: number;
  };
  competitors: { name: string; count: number; isYou: boolean; locked: boolean }[];
  history: Scan["history"];
  agents: AgentsState;
  scoreboard: ScoreRow[];
  pages: WinPage[];
  pagesQuota: { used: number; limit: number };
  cms: CmsLink | null;
  access: { control: boolean; owner: boolean; unlocked: boolean; agents: boolean; pages: boolean; publish: boolean; signedIn: boolean; plan: string; measure: "live" | "demo" | "off" };
}

/** One row per customer question of the round: won (named), half (only linked), lost, or still to ask. */
function scoreboard(scan: Scan, round: Round | null, prev: Round | null, unlocked: boolean, showPages: boolean): ScoreRow[] {
  if (!round) return [];
  const pages = scan.winPages || [];
  return round.questionIds.map((qid, i) => {
    const q = scan.questions.find((x) => x.id === qid);
    const a = round.answers.find((x) => x.questionId === qid);
    const was = prev?.answers.find((x) => x.questionId === qid)?.mention;
    const locked = !unlocked && i >= 2;
    const pg = showPages ? pages.find((p) => p.questionId === qid) : undefined;
    return {
      id: qid,
      text: locked ? undefined : q?.text,
      intent: locked ? undefined : q?.intent,
      status: a ? a.mention : "pending",
      position: a?.position,
      rivals: locked || !a ? [] : a.businesses.map((b) => b.name).filter((n) => !sameBusiness(n, scan.profile.name)).slice(0, 3),
      was: unlocked ? was : undefined,
      locked,
      page: pg ? { id: pg.id, status: pg.status, live: !!pg.published?.live, url: pg.published?.url } : undefined,
    };
  });
}

export function scanView(scan: Scan, round: Round | null, ctx: { user: User | null; control: boolean; prev?: Round | null; pagesUsed?: number }): ScanView {
  const owner = !!ctx.user && scan.ownerId === ctx.user.id;
  const unlocked = owner && (isPaid(ctx.user!.plan) || isAdmin(ctx.user));
  const agents = agentsAllowed(ctx.user, scan);
  const pagesOk = pagesAllowed(ctx.user, scan);
  const prev = round?.kind === "official" && ctx.prev?.kind === "official" && ctx.prev.id !== round.id ? ctx.prev : null;
  const fixes = topFixes(scan.readiness, unlocked ? 50 : 3);
  const comp = competitorTable(scan, round);
  const done = round?.answers || [];
  return {
    id: scan.id,
    profile: scan.profile,
    readiness: { score: scan.readiness.score, groups: scan.readiness.groups, pagesRead: scan.readiness.pagesRead },
    fixes: fixes.map(({ id, label, status, why, fix, evidence }) => ({ id, label, status, why, fix, evidence })),
    checklist: scan.readiness.checks.map((c) =>
      unlocked || c.status === "good" || fixes.some((f) => f.id === c.id) ? { id: c.id, group: c.group, label: c.label, status: c.status, why: c.why, fix: c.fix, evidence: c.evidence } : { id: c.id, group: c.group, label: c.label, status: c.status }
    ),
    questions: scan.questions.slice(0, unlocked ? 20 : PLANS.free.questions),
    round: round
      ? {
          id: round.id,
          kind: round.kind,
          status: round.status,
          total: round.questionIds.length,
          done: done.length,
          named: done.filter((a) => a.mention === "named").length,
          error: round.error,
          finishedAt: round.finishedAt,
          dots: round.questionIds.map((qid, i) => {
            const a = done.find((x) => x.questionId === qid);
            const q = scan.questions.find((x) => x.id === qid);
            return { mention: a ? a.mention : "pending", question: unlocked || i < 2 ? q?.text : undefined, locked: !unlocked && i >= 2 };
          }),
          answers: done.slice(0, unlocked ? done.length : FREE_ANSWERS).map((a) => ({
            question: a.question,
            text: a.text,
            mention: a.mention,
            position: a.position,
            sources: a.sources,
            businesses: a.businesses.map((b) => b.name),
            cached: a.cached,
            model: a.model,
          })),
          lockedAnswers: unlocked ? 0 : Math.max(0, done.length - FREE_ANSWERS),
        }
      : null,
    competitors: comp.map((c, i) => {
      const locked = !unlocked && !c.isYou && comp.filter((x, j) => !x.isYou && j < i).length >= FREE_COMPETITORS;
      return { name: locked ? "" : c.name, count: c.count, isYou: c.isYou, locked };
    }),
    history: unlocked ? scan.history : scan.history.slice(-1),
    agents: agents ? scan.agents || {} : {},
    scoreboard: scoreboard(scan, round, prev, unlocked, pagesOk),
    pages: pagesOk ? [...(scan.winPages || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [],
    pagesQuota: { used: pagesOk ? ctx.pagesUsed || 0 : 0, limit: pageLimit(pagesOk ? ctx.user : null) },
    cms: pagesOk ? scan.cms || null : null,
    access: { control: ctx.control, owner, unlocked, agents, pages: pagesOk, publish: pagesOk && cmsEnabled(), signedIn: !!ctx.user, plan: ctx.user?.plan || "free", measure: measureMode() },
  };
}
