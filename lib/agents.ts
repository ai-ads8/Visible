import "server-only";
import { audit } from "./audit";
import { isAdmin, type User } from "./auth";
import { aiJson, maxCostPerWrite } from "./engine/ai";
import { siteText } from "./engine/autoprofile";
import { safeFetch } from "./engine/fetch";
import { domainOf, normalize } from "./engine/mentions";
import { liveEnabled, reserveSpend } from "./guard";
import { hit, today } from "./store";
import type { AgentsState, Blog, ReviewItem, Scan } from "./types";

/*
 * The three agents. Each run is one explicit click by a paying owner (or an admin), never automatic.
 *  - GEO: real reviews from Google (Places API), plus business details, FAQ and llms.txt written from the site.
 *  - SEO: real search suggestions (Google autocomplete), then a blog for the search the owner picks.
 *  - Social: posts built on real reviews (image drawn in the browser, caption written here).
 * Nothing is invented: reviews are only ever quoted from Google with their author; texts use only facts from the site.
 * Every paid call reserves its worst-case cost against the daily budget first; each agent runs at most
 * AGENT_RUNS_PER_DAY times per business per day.
 */

export type AgentId = "geo" | "seo" | "social";
export class AgentError extends Error {}

export const agentsAllowed = (user: User | null, scan: Scan) =>
  !!user && scan.ownerId === user.id && (user.plan === "growth" || user.plan === "pro" || isAdmin(user));

const lang = (scan: Scan) => scan.profile.language || "en";

async function paidCall<T>(instructions: string, input: string, maxOut = 3500): Promise<T> {
  if (!liveEnabled()) throw new AgentError("The agents aren't switched on yet.");
  const settle = await reserveSpend(maxCostPerWrite());
  if (!settle) throw new AgentError("Today's AI budget is used up. Try again tomorrow.");
  try {
    const { data, costUsd } = await aiJson<T>(instructions, input, maxOut);
    await settle(costUsd);
    return data;
  } catch (e) {
    await settle(0);
    throw e;
  }
}

/* ---------------- Google reviews (Places API, New) ---------------- */

type Place = {
  displayName?: { text?: string };
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: { rating?: number; text?: { text?: string }; originalText?: { text?: string }; authorAttribution?: { displayName?: string }; relativePublishTimeDescription?: string }[];
};

type Geo = NonNullable<AgentsState["geo"]>;

async function googleReviews(scan: Scan): Promise<{ reviews: ReviewItem[]; rating?: Geo["rating"]; note?: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { reviews: [], note: "Google reviews need a Google Places key (GOOGLE_PLACES_API_KEY)." };
  const settle = await reserveSpend(Number(process.env.PLACES_PRICE_USD || 0.04));
  if (!settle) throw new AgentError("Today's budget is used up. Try again tomorrow.");
  const p = scan.profile;
  let settled = false;
  try {
    const res = await fetch(`${process.env.PLACES_BASE_URL || "https://places.googleapis.com"}/v1/places:searchText`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews",
      },
      body: JSON.stringify({ textQuery: [p.name, p.city].filter(Boolean).join(" "), languageCode: lang(scan), regionCode: p.country, pageSize: 5 }),
    });
    settled = true;
    await settle(Number(process.env.PLACES_PRICE_USD || 0.04));
    if (!res.ok) {
      console.error("places failed", res.status, (await res.text()).slice(0, 200));
      return { reviews: [], note: "Google didn't answer. Try again later." };
    }
    const places = ((await res.json()) as { places?: Place[] }).places || [];
    // Only the business itself: same website, or the same name.
    const own =
      places.find((x) => x.websiteUri && domainOf(x.websiteUri) === p.domain) ||
      places.find((x) => x.displayName?.text && normalize(x.displayName.text).includes(normalize(p.name).trim()));
    if (!own) return { reviews: [], note: "We couldn't find your business on Google Maps. Check that your Google Business Profile exists and links to your website." };
    const reviews = (own.reviews || [])
      .map((r) => ({
        quote: String(r.originalText?.text || r.text?.text || "").trim().slice(0, 600),
        author: r.authorAttribution?.displayName || undefined,
        rating: r.rating && r.rating >= 1 && r.rating <= 5 ? Math.round(r.rating) : undefined,
        source: "Google",
        url: own.googleMapsUri,
        when: r.relativePublishTimeDescription,
      }))
      .filter((r) => r.quote.length > 12);
    return {
      reviews,
      rating: own.rating ? { value: own.rating, count: own.userRatingCount, source: "Google", url: own.googleMapsUri } : undefined,
    };
  } catch (e) {
    if (!settled) await settle(0);
    console.error("places error", String(e).slice(0, 200));
    return { reviews: [], note: "Google didn't answer. Try again later." };
  }
}

/* ---------------- GEO ---------------- */

async function runGeo(scan: Scan): Promise<NonNullable<AgentsState["geo"]>> {
  const g = await googleReviews(scan);
  const p = scan.profile;
  const out = await paidCall<{ facts?: NonNullable<AgentsState["geo"]>["facts"]; faq?: { q?: string; a?: string }[]; llms?: string }>(
    "You help a small business make its website clear to AI assistants. Use only facts from the website text. Never invent.",
    `Business: ${p.name} (${p.category}${p.city ? ", " + p.city : ""}), ${p.domain}.
From the website text only, return:
{"facts": {"address": "", "postalCode": "", "phone": "", "email": "", "openingHours": "in schema.org format like 'Mo-Su 16:00-22:00', or empty", "priceRange": "e.g. € or €€, or empty", "description": "one plain sentence"},
 "faq": [6 questions customers ask with short, direct answers, in language '${lang(scan)}'; only answers the website supports, fewer is fine; as {"q": "", "a": ""}],
 "llms": "a plain llms.txt in markdown, in English, under 150 words: what the business is, where, what it offers, how to contact it"}

Website text:
${siteText(scan.pages || [], 24000)}`
  );
  return {
    ranAt: new Date().toISOString(),
    reviews: g.reviews,
    rating: g.rating,
    note: g.note,
    facts: out.facts || {},
    faq: (out.faq || []).filter((f) => f?.q && f?.a).slice(0, 8).map((f) => ({ q: String(f.q), a: String(f.a) })),
    llms: String(out.llms || ""),
  };
}

/* ---------------- SEO ---------------- */

async function suggestions(seed: string, scan: Scan): Promise<string[]> {
  try {
    const url = `${process.env.SUGGEST_BASE_URL || "https://suggestqueries.google.com"}/complete/search?client=firefox&hl=${encodeURIComponent(lang(scan))}&gl=${encodeURIComponent(scan.profile.country.toLowerCase())}&q=${encodeURIComponent(seed)}`;
    const r = await safeFetch(url, { accept: "application/json,text/javascript,*/*", maxBytes: 100_000 });
    const j = JSON.parse(r.body) as [string, string[]];
    return Array.isArray(j[1]) ? j[1].map(String).slice(0, 10) : [];
  } catch {
    return [];
  }
}

async function runSeo(scan: Scan): Promise<NonNullable<AgentsState["seo"]>> {
  const p = scan.profile;
  const seeds = [...new Set([[p.service || p.category, p.city].filter(Boolean).join(" "), [p.category, p.city].filter(Boolean).join(" "), p.service].filter(Boolean))].slice(0, 3);
  const sugg = [...new Set((await Promise.all(seeds.map((s) => suggestions(s, scan)))).flat())];
  const out = await paidCall<{ keywords?: { keyword?: string; why?: string }[] }>(
    "You pick blog topics that bring local customers to a small business.",
    `Business: ${p.name}, a ${p.category}${p.city ? " in " + p.city : ""}. Language: ${lang(scan)}.
Real Google search suggestions people typed (may be empty): ${JSON.stringify(sugg.slice(0, 30))}
Customer questions: ${JSON.stringify(scan.questions.slice(0, 10).map((q) => q.text))}
Pick the 6 best searches to write a blog for: relevant, with buying or local intent, in that language. Prefer the real suggestions; add your own only to reach 6.
Return {"keywords": [{"keyword": "", "why": "one short reason, in English"}]}`,
    800
  );
  const keywords = (out.keywords || [])
    .filter((k) => k?.keyword)
    .slice(0, 6)
    .map((k) => ({ keyword: String(k.keyword).slice(0, 80), real: sugg.some((s) => normalize(s) === normalize(String(k.keyword))), why: String(k.why || "").slice(0, 140) }));
  return { ranAt: new Date().toISOString(), keywords, picked: keywords[0]?.keyword };
}

async function writeBlog(scan: Scan, keyword: string): Promise<Blog> {
  const p = scan.profile;
  const b = await paidCall<Partial<Blog> & { metaDescription?: string }>(
    "You write helpful, honest blog posts for small local businesses. Use only facts from the website text; never invent prices, awards, years or reviews.",
    `Write a blog post for ${p.name}, a ${p.category}${p.city ? " in " + p.city : ""}, targeting the search "${keyword}". Language: ${lang(scan)}. About 550 words, helpful first, sales second, ending with a short call to action. Use the search phrase naturally in the title, the first paragraph and one heading.
Return {"title": "under 60 characters", "metaDescription": "under 155 characters", "slug": "url-slug", "intro": "", "sections": [{"heading": "", "paragraphs": [""], "bullets": [""]}], "faq": [{"q": "", "a": ""}], "cta": ""}

Website text:
${siteText(scan.pages || [], 20000)}`,
    4000
  );
  return {
    title: String(b.title || keyword).slice(0, 90),
    meta: String(b.metaDescription || b.meta || "").slice(0, 200),
    slug: String(b.slug || keyword).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70),
    intro: String(b.intro || ""),
    sections: (Array.isArray(b.sections) ? b.sections : []).slice(0, 8).map((s) => ({ heading: String(s?.heading || ""), paragraphs: (s?.paragraphs || []).map(String), bullets: (s?.bullets || []).map(String).filter(Boolean) })),
    faq: (Array.isArray(b.faq) ? b.faq : []).slice(0, 5).map((f) => ({ q: String(f?.q || ""), a: String(f?.a || "") })).filter((f) => f.q && f.a),
    cta: String(b.cta || ""),
  };
}

/* ---------------- Social ---------------- */

async function runSocial(scan: Scan, geo: NonNullable<AgentsState["geo"]>): Promise<NonNullable<AgentsState["social"]>> {
  const good = geo.reviews.map((r, i) => ({ ...r, i })).filter((r) => !r.rating || r.rating >= 4);
  if (!good.length) return { ranAt: new Date().toISOString(), posts: [] };
  const p = scan.profile;
  const out = await paidCall<{ posts?: { review?: number; headline?: string; quote?: string; caption?: string; hashtags?: string[] }[] }>(
    "You write social media posts for a small business, built on real customer reviews. Keep the reviewer's own words; never invent claims.",
    `Business: ${p.name}, a ${p.category}${p.city ? " in " + p.city : ""}. Language: ${lang(scan)}.
For the best 3 reviews below make: a short image headline (max 6 words), a shortened quote for the image (the reviewer's own words, only cut, max 22 words), an Instagram/TikTok caption (2–4 short lines, warm, with a call to action) and 5–8 hashtags including the town.
Return {"posts": [{"review": index, "headline": "", "quote": "", "caption": "", "hashtags": [""]}]}
Reviews: ${JSON.stringify(good.map((r) => ({ index: r.i, quote: r.quote, author: r.author, rating: r.rating })))}`,
    2000
  );
  const posts = (out.posts || [])
    .filter((x) => typeof x?.review === "number" && geo.reviews[x.review])
    .slice(0, 3)
    .map((x) => ({
      review: x.review as number,
      headline: String(x.headline || "").slice(0, 60),
      quote: String(x.quote || geo.reviews[x.review as number].quote).slice(0, 220),
      caption: String(x.caption || ""),
      hashtags: (x.hashtags || []).map((h) => "#" + String(h).replace(/^#/, "").replace(/\s+/g, "")).slice(0, 8),
    }));
  return { ranAt: new Date().toISOString(), posts };
}

/* ---------------- entry ---------------- */

export async function runAgent(scan: Scan, user: User, id: AgentId, opts: { keyword?: string } = {}): Promise<AgentsState> {
  const limit = Number(process.env.AGENT_RUNS_PER_DAY || 6);
  if ((await hit(`agent:${scan.id}:${id}:${today()}`, 86400 * 2)) > limit) throw new AgentError("This agent has run a lot today. Try again tomorrow.");
  const agents: AgentsState = { ...(scan.agents || {}) };
  if (id === "geo") agents.geo = await runGeo(scan);
  if (id === "seo") {
    if (opts.keyword) {
      if (!agents.seo) throw new AgentError("Run the SEO agent first.");
      agents.seo = { ...agents.seo, picked: opts.keyword, blog: await writeBlog(scan, opts.keyword) };
    } else agents.seo = await runSeo(scan);
  }
  if (id === "social") {
    if (!agents.geo) agents.geo = await runGeo(scan);
    agents.social = await runSocial(scan, agents.geo);
  }
  await audit("agent.run", user.id, { scan: scan.id, agent: id, blog: !!opts.keyword });
  return agents;
}
