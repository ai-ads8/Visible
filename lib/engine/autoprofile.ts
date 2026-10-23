import "server-only";
import { aiJson, maxCostPerWrite, profileModel } from "./ai";
import { reserveSpend } from "@/lib/guard";
import type { BusinessProfile, Question } from "@/lib/types";

/*
 * Reads the website's text and fills in the business details and the customer questions, in the language the
 * customers speak. One AI call per scan, on the cheap model, budget-guarded.
 * Falls back to the free heuristic profile (and the confirm step) when it can't run.
 */

const INTENTS = ["Best", "Recommendation", "Reviews", "Service", "Price", "Availability", "Occasion", "Near me", "Compare", "Trust"];

function hashId(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return "q" + (h >>> 0).toString(36);
}

export const siteText = (pages: { url: string; text: string }[], max = 30000) => pages.map((p) => `=== ${p.url} ===\n${p.text}`).join("\n\n").slice(0, max);

type Read = {
  name?: string;
  category?: string;
  service?: string;
  city?: string;
  country?: string;
  reach?: string;
  language?: string;
  questions?: { text?: string; intent?: string }[];
};

export async function readProfile(pages: { url: string; text: string }[], guess: BusinessProfile, fixed?: Partial<BusinessProfile>): Promise<{ profile: BusinessProfile; questions: Question[] } | null> {
  const settle = await reserveSpend(maxCostPerWrite(profileModel()));
  if (!settle) return null;
  try {
    const known = fixed ? `\nThe owner confirmed these details, use them as they are: ${JSON.stringify(fixed)}\n` : "";
    const { data, costUsd } = await aiJson<Read>(
      "You analyse a small business's website for an AI-visibility service.",
      `Below is the text of pages of ${guess.domain}.${known}
Return this JSON:
{"name": "the business name as customers know it",
 "category": "what kind of business, short and plain, in English (e.g. 'pizzeria', 'dentist')",
 "service": "their single most important product or service, short, in English, or empty",
 "city": "the town or city they are in or mainly serve, or empty if online-only",
 "country": "ISO 3166-1 alpha-2",
 "reach": "local" or "online",
 "language": "ISO 639-1 language their customers speak",
 "questions": [20 questions a real customer would type into ChatGPT when looking for a business like this, in that language, short and natural, about their core offering and town; never mention this business's name; most important first; each {"text": "...", "intent": one of ${JSON.stringify(INTENTS)}}]}

Website text:
${siteText(pages)}`,
      3500,
      profileModel()
    );
    await settle(costUsd);
    const p: BusinessProfile = {
      ...guess,
      name: String(fixed?.name || data.name || guess.name).slice(0, 80),
      category: String(fixed?.category || data.category || guess.category).slice(0, 60),
      service: String(fixed?.service ?? data.service ?? "").slice(0, 60),
      city: String(fixed?.city ?? data.city ?? guess.city).slice(0, 60),
      country: /^[A-Z]{2}$/i.test(String(fixed?.country || data.country || "")) ? String(fixed?.country || data.country).toUpperCase() : guess.country,
      reach: (fixed?.reach || data.reach) === "online" ? "online" : "local",
      language: String(data.language || "en").slice(0, 5).toLowerCase(),
      confirmed: true,
      auto: !fixed,
    };
    const seen = new Set<string>();
    const questions = (Array.isArray(data.questions) ? data.questions : [])
      .map((q) => ({ text: String(q?.text || "").trim().slice(0, 200), intent: INTENTS.includes(String(q?.intent)) ? String(q?.intent) : "Recommendation" }))
      .filter((q) => q.text.length > 8 && !q.text.toLowerCase().includes(p.name.toLowerCase()) && !seen.has(q.text.toLowerCase()) && !!seen.add(q.text.toLowerCase()))
      .slice(0, 20)
      .map((q) => ({ id: hashId(q.text.toLowerCase()), ...q }));
    if (questions.length < 3) return null;
    return { profile: p, questions };
  } catch (e) {
    await settle(0);
    console.error("profile read failed", String((e as Error)?.message || e).slice(0, 200));
    return null;
  }
}
