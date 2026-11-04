import "server-only";
import { z } from "zod";
import { audit } from "./audit";
import { isAdmin, newId, type User } from "./auth";
import { agentsAllowed, paidCall } from "./agents";
import { siteText } from "./engine/autoprofile";
import { sameBusiness } from "./engine/mentions";
import { demoEnabled, liveEnabled } from "./guard";
import { openPlaceholders, slugify } from "./pagekit";
import { PLANS } from "./plans";
import { kvGet, kvIncr } from "./store";
import type { AnswerRecord, Round, Scan, WinPage } from "./types";

/*
 * Pages that win. For a customer question where AI recommends someone else, the page agent writes one page on
 * the owner's website that answers exactly that question: the direct answer first (the part an AI assistant can
 * quote), then the facts from the site, an FAQ and a call to action. The owner reviews it, fills in anything we
 * couldn't find ([[add: …]]), approves it and publishes it to WordPress or Shopify, or copies the HTML.
 *
 * Honest by design: only facts from the website; competitors are never named on the page; nothing guessed goes
 * online (placeholders block approval). Each page is one explicit click, counted against the plan's monthly quota
 * and the daily AI budget (via paidCall). Test mode writes a clearly labelled sample page with no AI call.
 */

export class PageError extends Error {}

export const pagesAllowed = agentsAllowed;
export const MAX_PAGES_PER_SCAN = 60;

const month = () => new Date().toISOString().slice(0, 7);
const quotaKey = (scanId: string) => `pages:${scanId}:${month()}`;

export function pageLimit(user: User | null): number {
  if (!user) return 0;
  if (isAdmin(user)) return Math.max(PLANS[user.plan].pages, 30);
  return PLANS[user.plan].pages;
}
export async function pagesUsed(scanId: string): Promise<number> {
  return Math.max(0, Number((await kvGet<number>(quotaKey(scanId))) || 0));
}

/** The latest answer we have for a question (from the round on screen, else the last official one). */
export function answerFor(questionId: string, rounds: (Round | null)[]): AnswerRecord | undefined {
  for (const r of rounds) {
    const a = r?.answers.find((x) => x.questionId === questionId);
    if (a) return a;
  }
  return undefined;
}

const lang = (scan: Scan) => scan.profile.language || "en";

type Draft = { title?: string; slug?: string; meta?: string; answer?: string; sections?: { heading?: string; text?: string }[]; faqTitle?: string; faq?: { q?: string; a?: string }[]; cta?: string; angle?: string };

async function writeLive(scan: Scan, question: string, a: AnswerRecord | undefined, rivals: string[]): Promise<Draft> {
  const p = scan.profile;
  return paidCall<Draft>(
    `You write one web page for a small business so that AI assistants (ChatGPT, Gemini, Perplexity) and Google can recommend it for one specific customer question.
Rules:
- Write in language '${lang(scan)}'. Plain, warm, specific; no hype, no superlatives you can't prove.
- Use ONLY facts found in the website text. Never invent prices, years, awards, certifications, numbers, staff names or reviews.
- When the page needs a fact the website doesn't give (a price, opening hours, service area, how fast), write a placeholder like [[add: your starting price]] instead of guessing. Use few placeholders, only for facts that make the page clearly better.
- Never mention competitors or other businesses.`,
    `Business: ${p.name} — ${p.category}${p.service ? ` (main service: ${p.service})` : ""}${p.reach === "local" && p.city ? `, in ${p.city}` : ""}. Website: ${p.domain}.
Customer question to win: "${question}"
${rivals.length ? `AI currently recommends instead: ${rivals.join(", ")}.` : "AI currently doesn't recommend this business for it."}
${a?.text ? `What AI answered (for context on what it looks for): """${a.text.slice(0, 1500)}"""` : ""}

Return JSON:
{"title": "page title under 60 characters, matching the question's wording, with the place if local",
 "slug": "short-url-slug",
 "meta": "search description under 155 characters",
 "answer": "40–70 words that directly answer the question, naming ${p.name}${p.reach === "local" && p.city ? ` and ${p.city}` : ""} in the first sentence — this is what AI quotes",
 "sections": [3 to 5 sections like {"heading": "", "text": "paragraphs separated by a blank line; a list as lines starting with '- '"}: what exactly is offered for this question, who it is for, area/how it works, why customers choose them (only facts), how to book or contact],
 "faqTitle": "heading for the FAQ in the page language",
 "faq": [3 to 5 follow-up questions customers ask about this, with short direct answers, as {"q": "", "a": ""}],
 "cta": "one sentence telling the reader what to do next, with the contact route from the site",
 "angle": "one or two sentences in English for the owner: why this page helps AI pick them for this question"}

Website text:
${siteText(scan.pages || [], 22000)}`,
    4000
  );
}

/** Test mode only: a clearly labelled sample built from what the scan already knows. No AI call, no cost. */
function writeSample(scan: Scan, question: string, rivals: string[]): Draft {
  const p = scan.profile;
  const where = p.reach === "local" && p.city ? ` in ${p.city}` : "";
  const what = p.service || p.category;
  return {
    title: `${what[0]?.toUpperCase() || ""}${what.slice(1)}${where}`.slice(0, 60),
    slug: slugify(`${what}${where}`),
    meta: `${p.name} offers ${what}${where}. See what's included, who it's for and how to book.`,
    answer: `${p.name} is a ${p.category}${where} that helps with exactly this: ${what}. Customers come to us for clear advice, fair prices and a team that does what it promises. Prices start at [[add: your starting price]].`,
    sections: [
      { heading: `What ${p.name} offers`, text: `We take care of ${what} from start to finish.\n\n- A clear plan before we start\n- One contact person\n- [[add: something customers often thank you for]]` },
      { heading: `Who it's for`, text: `For people${where} who want ${what} done properly, without surprises.` },
      { heading: "How it works", text: `Get in touch, we look at what you need and give you a clear quote. Most jobs start within [[add: how fast you can start]].` },
    ],
    faqTitle: "Questions people ask",
    faq: [
      { q: `How much does ${what} cost?`, a: "It depends on what you need. Ask for a quote and you'll know the price up front." },
      { q: "Do you work in my area?", a: `We work${where || " in the region"} and nearby.` },
    ],
    cta: `Contact ${p.name} through ${p.domain} for a quote.`,
    angle: `This is a sample page from test mode, not written by AI. A real page answers “${question}” directly${rivals.length ? `, the question where AI now picks ${rivals.slice(0, 2).join(" and ")}` : ""}.`,
  };
}

const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+$/g, "").slice(0, max);

function clean(d: Draft, question: string): Omit<WinPage, "id" | "questionId" | "question" | "status" | "createdAt" | "updatedAt" | "rivals" | "sample"> {
  const title = str(d.title || question, 90).trim();
  return {
    title,
    slug: slugify(d.slug || title),
    meta: str(d.meta, 200).trim(),
    answer: str(d.answer, 900).trim(),
    sections: (Array.isArray(d.sections) ? d.sections : [])
      .slice(0, 6)
      .map((s) => ({ heading: str(s?.heading, 120).trim(), text: str(s?.text, 3000).trim() }))
      .filter((s) => s.heading || s.text),
    faqTitle: str(d.faqTitle, 80).trim() || undefined,
    faq: (Array.isArray(d.faq) ? d.faq : [])
      .slice(0, 6)
      .map((f) => ({ q: str(f?.q, 200).trim(), a: str(f?.a, 800).trim() }))
      .filter((f) => f.q && f.a),
    cta: str(d.cta, 300).trim(),
    angle: str(d.angle, 400).trim(),
  };
}

/**
 * Writes (or rewrites) the page for one question. Refuses when the business already ranks first for it, when the
 * monthly quota is used, or when AI isn't switched on. Returns the scan's updated page list.
 */
export async function draftPage(scan: Scan, user: User, questionId: string, rounds: (Round | null)[]): Promise<WinPage[]> {
  const q = scan.questions.find((x) => x.id === questionId);
  if (!q) throw new PageError("This question isn't part of your scan.");
  const a = answerFor(questionId, rounds);
  if (!a) throw new PageError("Check this question with AI first, so the page can aim at what AI looks for.");
  if (a.mention === "named" && a.position === 1) throw new PageError("You already rank first for this question.");
  const pages = scan.winPages || [];
  const existing = pages.find((p) => p.questionId === questionId);
  if (!existing && pages.length >= MAX_PAGES_PER_SCAN) throw new PageError("You've reached the maximum number of pages for this business.");
  if (existing?.status === "published") throw new PageError("This page is already on your website. Edit it instead of writing a new one.");

  const live = liveEnabled();
  if (!live && !demoEnabled()) throw new PageError("The page agent isn't switched on yet.");

  const limit = pageLimit(user);
  if (live) {
    const used = await kvIncr(quotaKey(scan.id), 1, 86400 * 40);
    if (used > limit) {
      await kvIncr(quotaKey(scan.id), -1, 86400 * 40);
      throw new PageError(limit ? `You've written all ${limit} pages of this month. New pages are available on the 1st.` : "Pages that win are part of the Growth plan.");
    }
  }

  const rivals = a.businesses.map((b) => b.name).filter((n) => !sameBusiness(n, scan.profile.name)).slice(0, 4);
  let draft: Draft;
  try {
    draft = live ? await writeLive(scan, q.text, a, rivals) : writeSample(scan, q.text, rivals);
  } catch (e) {
    if (live) await kvIncr(quotaKey(scan.id), -1, 86400 * 40);
    throw e;
  }
  const body = clean(draft, q.text);
  if (!body.answer || body.sections.length === 0) {
    if (live) await kvIncr(quotaKey(scan.id), -1, 86400 * 40);
    throw new PageError("The page agent couldn't write this page from your website. Add more about this service to your site and try again.");
  }
  const now = new Date().toISOString();
  const page: WinPage = {
    id: existing?.id || newId(8),
    questionId,
    question: q.text,
    status: "draft",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...body,
    // Never collide with another page's address.
    slug: uniqueSlug(body.slug, pages.filter((p) => p.id !== existing?.id)),
    rivals,
    sample: !live || undefined,
    published: existing?.published,
  };
  await audit("page.draft", user.id, { scan: scan.id, q: questionId, sample: !live });
  return [...pages.filter((p) => p.id !== page.id), page];
}

function uniqueSlug(slug: string, others: WinPage[]): string {
  let s = slug;
  for (let i = 2; others.some((p) => p.slug === s); i++) s = `${slug}-${i}`;
  return s;
}

/* ---------------- editing ---------------- */

export const PageEdit = z.object({
  title: z.string().trim().min(3, "Give the page a title.").max(90).optional(),
  slug: z.string().trim().min(1).max(70).optional(),
  meta: z.string().trim().max(200).optional(),
  answer: z.string().trim().min(20, "The answer needs at least one full sentence.").max(900).optional(),
  sections: z.array(z.object({ heading: z.string().trim().max(120), text: z.string().trim().max(3000) })).max(8).optional(),
  faqTitle: z.string().trim().max(80).optional(),
  faq: z.array(z.object({ q: z.string().trim().max(200), a: z.string().trim().max(800) })).max(8).optional(),
  cta: z.string().trim().max(300).optional(),
  status: z.enum(["draft", "approved"]).optional(),
});
export type PageEdit = z.infer<typeof PageEdit>;

export function applyEdit(scan: Scan, pageId: string, edit: PageEdit): WinPage[] {
  const pages = scan.winPages || [];
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw new PageError("Page not found.");
  const next: WinPage = { ...page, updatedAt: new Date().toISOString() };
  if (edit.title !== undefined) next.title = edit.title;
  if (edit.slug !== undefined) next.slug = uniqueSlug(slugify(edit.slug), pages.filter((p) => p.id !== page.id));
  if (edit.meta !== undefined) next.meta = edit.meta;
  if (edit.answer !== undefined) next.answer = edit.answer;
  if (edit.sections !== undefined) next.sections = edit.sections.filter((s) => s.heading || s.text);
  if (edit.faqTitle !== undefined) next.faqTitle = edit.faqTitle || undefined;
  if (edit.faq !== undefined) next.faq = edit.faq.filter((f) => f.q && f.a);
  if (edit.cta !== undefined) next.cta = edit.cta;
  // Any content change sends the page back to draft, so the owner always approves exactly what goes live.
  // A published page keeps its link; it shows "changes not published yet" until it is published again.
  const contentChanged = Object.keys(edit).some((k) => k !== "status" && edit[k as keyof PageEdit] !== undefined);
  if (contentChanged || edit.status === "draft") next.status = "draft";
  if (edit.status === "approved") {
    const open = openPlaceholders(next);
    if (open.length) throw new PageError(`Fill in ${open.length === 1 ? "one thing" : `${open.length} things`} first: ${open.slice(0, 3).join("; ")}${open.length > 3 ? "…" : ""}.`);
    if (next.sample) throw new PageError("This is a sample page from test mode. Write a real page before approving it.");
    next.status = "approved";
  }
  return pages.map((p) => (p.id === page.id ? next : p));
}
