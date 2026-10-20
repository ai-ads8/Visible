import "server-only";
import type { CrawlResult } from "./crawl";
import type { BusinessProfile, CheckStatus, GroupId, Readiness, ReadinessCheck } from "@/lib/types";

/*
 * "AI readiness": a deterministic website check (no AI, no paid API, €0 per scan).
 * Same idea as Ai Ads' sitecheck (evidence per finding, "good / improve / missing", weighted score), rebuilt with
 * international, language-neutral signals so it works for any country. Every finding names its evidence.
 */

export const GROUPS: { id: GroupId; title: string }[] = [
  { id: "read", title: "AI can read your site" },
  { id: "understand", title: "AI understands what you do" },
  { id: "trust", title: "AI trusts your business" },
  { id: "answers", title: "You answer customer questions" },
];

const AI_BOTS = ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "PerplexityBot", "ClaudeBot", "Google-Extended", "bingbot"];

/** Bots whose robots.txt group (or the * group) disallows the whole site. */
export function blockedBots(robots: string | null): string[] {
  if (!robots) return [];
  const groups: { agents: string[]; disallowAll: boolean; allowAll: boolean }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, field, value] = m;
    if (/^user-agent$/i.test(field)) {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], disallowAll: false, allowAll: false }));
      cur.agents.push(value.trim().toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (/^disallow$/i.test(field) && value.trim() === "/") cur.disallowAll = true;
    if (/^allow$/i.test(field) && value.trim() === "/") cur.allowAll = true;
  }
  return AI_BOTS.filter((bot) => {
    const own = groups.find((g) => g.agents.includes(bot.toLowerCase()));
    const g = own || groups.find((x) => x.agents.includes("*"));
    return !!g && g.disallowAll && !g.allowAll;
  });
}

const types = (n: Record<string, unknown>) => ([] as unknown[]).concat(n["@type"] ?? []).map(String);
const PRICE_RE = /(?:[$€£¥₱฿]|\b(?:usd|eur|gbp|aud|cad|php|thb|chf)\b)\s?\d{1,5}(?:[.,]\d{2})?|\d{1,5}(?:[.,]\d{2})?\s?(?:[$€£₱฿]|\b(?:usd|eur|gbp|euro|dollars?)\b)/i;
const HOURS_RE = /\b(opening hours|hours|open (?:daily|mon|monday|7 days)|mon(?:day)?\s*[-–]\s*(?:fri|sat|sun)|openingstijden|öffnungszeiten|horaires|horario|orari)\b/i;
const SOCIAL_RE = /(facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|youtube\.com|x\.com|twitter\.com|pinterest\.com|yelp\.|tripadvisor\.|trustpilot\.com|google\.[a-z.]+\/maps|g\.page|maps\.app\.goo\.gl)/i;

export function buildReadiness(c: CrawlResult, profile: BusinessProfile): Readiness {
  const pages = c.pages;
  const home = pages.find((p) => p.kind === "home") || pages[0];
  const pageName = (u: string) => {
    try {
      const p = new URL(u).pathname;
      return p === "/" ? "Homepage" : p;
    } catch {
      return u;
    }
  };
  const findPage = (test: (p: (typeof pages)[number]) => boolean) => pages.find(test);
  const allLd = pages.flatMap((p) => p.jsonld);
  const allText = pages.map((p) => p.text).join("\n");
  const totalWords = pages.reduce((s, p) => s + p.words, 0);
  const checks: ReadinessCheck[] = [];
  const add = (id: string, group: GroupId, label: string, status: CheckStatus, why: string, fix: string, evidence?: string, weight = 1) =>
    checks.push({ id, group, label, status, why, fix, evidence, weight });

  /* ---------- AI can read your site ---------- */
  add("https", "read", "Secure connection (https)", c.https ? "good" : "missing", "AI tools and browsers trust secure sites more.", "Turn on https with your website host; most offer it for free.", c.startUrl);
  add(
    "text",
    "read",
    "Readable text on your homepage",
    home.words >= 150 ? "good" : home.words >= 60 ? "improve" : "missing",
    "AI reads the text of your pages. If it only loads with scripts or sits in images, AI sees an empty page.",
    "Put your key information as real text on the homepage: who you are, what you offer and where.",
    `${home.words} words found on ${pageName(home.url)}`,
    1.5
  );
  const blocked = blockedBots(c.robotsTxt);
  add(
    "bots",
    "read",
    "AI assistants are allowed in",
    blocked.length === 0 ? "good" : blocked.some((b) => /OAI-SearchBot|ChatGPT-User|PerplexityBot|bingbot/.test(b)) ? "missing" : "improve",
    blocked.length ? `Your robots.txt blocks ${blocked.join(", ")}. Blocked assistants can't read your site to recommend you.` : "Your site lets AI assistants read it.",
    "Remove the 'Disallow: /' lines for AI assistants in robots.txt (ask your web builder if unsure).",
    c.robotsTxt ? "robots.txt" : "No robots.txt (that's fine: nothing is blocked)",
    2
  );
  const noindex = pages.filter((p) => /noindex/.test(p.metaRobots));
  add("index", "read", "Pages may appear in search", noindex.length === 0 ? "good" : noindex.some((p) => p === home) ? "missing" : "improve", "Pages marked 'noindex' are hidden from search engines, which many AI tools rely on.", "Remove 'noindex' from pages customers should find.", noindex.map((p) => pageName(p.url)).join(", ") || undefined, 1.5);
  add("sitemap", "read", "Sitemap", c.sitemapFound ? "good" : "improve", "A sitemap helps search engines and AI find all your pages.", "Add a sitemap.xml; most website builders can switch one on.", c.sitemapFound ? "sitemap.xml" : undefined, 0.5);
  add("mobile", "read", "Works on phones", home.hasViewport ? "good" : "improve", "Most of your customers visit on a phone.", "Use a mobile-friendly (responsive) website theme.", pageName(home.url), 0.5);

  /* ---------- AI understands what you do ---------- */
  const titleOk = home.title.length >= 15 && home.title.length <= 70;
  add("title", "understand", "Clear page title", titleOk ? "good" : home.title ? "improve" : "missing", "Your page title is often the first thing AI uses to describe you.", "Use a title like 'Your Business — What you do in Your City'.", home.title ? `"${home.title.slice(0, 80)}"` : "No title found");
  add("description", "understand", "Short description of your business", home.metaDescription.length >= 50 ? "good" : home.metaDescription ? "improve" : "missing", "A one-line summary helps AI explain what you offer.", "Add a meta description of one or two sentences: what you do, for whom and where.", home.metaDescription ? `"${home.metaDescription.slice(0, 100)}"` : undefined);
  const bizLd = allLd.find((n) => types(n).some((t) => /LocalBusiness|Organization|Store|Restaurant|Dentist|Service|Attorney|Physician|Plumber|Electrician|Salon|Contractor|Hotel|AutoRepair|Agent/.test(t)));
  add("schema", "understand", "Business details in a format AI understands", bizLd ? "good" : "missing", "Structured data (schema.org) tells AI your name, type, address and hours without guessing.", "Add LocalBusiness structured data with your name, address, phone and opening hours.", bizLd ? `${types(bizLd).join(", ")} found` : undefined, 1.5);
  add("h1", "understand", "One main heading", home.h1.length === 1 ? "good" : home.h1.length ? "improve" : "missing", "Your main heading tells AI what the page is about.", "Use one main heading (H1) that says what you do.", home.h1.length ? `"${home.h1[0].slice(0, 80)}"${home.h1.length > 1 ? ` + ${home.h1.length - 1} more` : ""}` : undefined, 0.75);
  const services = findPage((p) => p.kind === "services" || p.kind === "prices");
  add("services", "understand", "Page about what you offer", services ? "good" : pages.length > 2 ? "improve" : "missing", "AI recommends businesses for specific needs. A clear services page lets it match you.", "Create a page that lists each service or product with a short explanation.", services ? pageName(services.url) : undefined, 1.5);
  if (profile.reach === "local") {
    const place = profile.city && new RegExp(`\\b${profile.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(allText);
    const addr = allLd.some((n) => n.address) || /\b\d{4,5}\b|\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/.test(allText);
    add("location", "understand", "Your location is on the site", place && addr ? "good" : place || addr ? "improve" : "missing", "For 'near me' questions, AI needs to know where you are.", "Show your full address and the areas you serve, as text, on your homepage or contact page.", place ? `"${profile.city}" mentioned` : undefined, 1.5);
  }

  /* ---------- AI trusts your business ---------- */
  const rating = allLd.find((n) => n.aggregateRating || types(n).includes("AggregateRating") || types(n).includes("Review"));
  const reviewPage = findPage((p) => p.kind === "reviews") || findPage((p) => /testimonial|reviews?|what (our )?(clients|customers) say|★/i.test(p.headings.join(" ")));
  add("reviews", "trust", "Customer reviews on your site", rating ? "good" : reviewPage ? "improve" : "missing", "AI prefers businesses that others vouch for.", "Show real customer reviews on your site, and mark your rating up with structured data.", rating ? "Rating in structured data" : reviewPage ? pageName(reviewPage.url) : undefined, 1.5);
  const about = findPage((p) => p.kind === "about");
  add("about", "trust", "About page", about ? "good" : "improve", "Who is behind the business matters to AI and to customers.", "Add an About page: your story, experience and the people behind the business.", about ? pageName(about.url) : undefined);
  const tel = pages.some((p) => p.links.some((l) => l.href.startsWith("tel:"))) || allLd.some((n) => n.telephone);
  const mail = pages.some((p) => p.links.some((l) => l.href.startsWith("mailto:")) || p.hasForm);
  add("contact", "trust", "Easy to contact", tel && mail ? "good" : tel || mail ? "improve" : "missing", "Real contact details are a strong sign that a business is genuine.", "Show your phone number and email (or a contact form) on every page, for example in the footer.", [tel && "phone", mail && "email or form"].filter(Boolean).join(" + ") || undefined, 1.25);
  const social = pages.some((p) => p.links.some((l) => SOCIAL_RE.test(l.href))) || allLd.some((n) => n.sameAs);
  add("profiles", "trust", "Links to your other profiles", social ? "good" : "improve", "Links to your Google, social and review profiles help AI confirm it's the same business everywhere.", "Link to your Google Business Profile and social profiles from your site.", social ? "Profile links found" : undefined, 0.75);
  const imgs = pages.flatMap((p) => p.images);
  const withAlt = imgs.filter((i) => i.alt.length > 2).length;
  if (imgs.length >= 3) add("images", "trust", "Images are described", withAlt / imgs.length >= 0.6 ? "good" : withAlt ? "improve" : "missing", "AI can't see photos. A short description (alt text) tells it what they show.", "Give each important photo a short description of what's in it.", `${withAlt} of ${imgs.length} images described`, 0.5);

  /* ---------- You answer customer questions ---------- */
  const faqLd = allLd.some((n) => types(n).includes("FAQPage"));
  const faqPage = findPage((p) => p.kind === "faq");
  const qCount = pages.reduce((s, p) => s + p.questions.length, 0);
  add("faq", "answers", "Answers to common questions", faqLd || (faqPage && qCount >= 4) ? "good" : faqPage || qCount >= 3 ? "improve" : "missing", "AI assistants answer questions. Sites that already answer them get quoted.", "Add an FAQ with 6–10 real questions customers ask, each with a short, direct answer.", faqLd ? "FAQ structured data" : faqPage ? pageName(faqPage.url) : qCount ? `${qCount} question${qCount === 1 ? "" : "s"} found` : undefined, 1.5);
  const priced = pages.find((p) => PRICE_RE.test(p.text));
  add("prices", "answers", "Prices or price ranges", priced ? "good" : "improve", "'How much does it cost?' is one of the most asked questions.", "Show prices, starting prices or typical ranges for your main services.", priced ? pageName(priced.url) : undefined);
  const hours = allLd.some((n) => n.openingHours || n.openingHoursSpecification) || HOURS_RE.test(allText);
  if (profile.reach === "local") add("hours", "answers", "Opening hours", hours ? "good" : "missing", "AI is often asked who is open now or this weekend.", "Show your opening hours as text and in your structured data.", hours ? "Opening hours found" : undefined);
  const action = findPage((p) => p.kind === "booking") || pages.find((p) => p.hasForm);
  add("action", "answers", "A clear next step for customers", action ? "good" : "improve", "When AI sends someone to you, they should be able to book, order or ask right away.", "Add a booking, quote or contact form that's easy to find.", action ? pageName(action.url) : undefined);
  add("depth", "answers", "Enough helpful content", totalWords >= 1200 ? "good" : totalWords >= 500 ? "improve" : "missing", "More useful detail gives AI more reasons to pick you for specific questions.", "Write a short page per service: what it is, who it's for, price, and how it works.", `${totalWords.toLocaleString("en")} words across ${pages.length} pages`, 1.25);
  add("llms", "answers", "AI summary file (llms.txt)", c.llmsTxt ? "good" : "improve", "A small, newer file some AI tools read for a quick summary of your business.", "Add an llms.txt file with a plain summary of your business and key pages.", c.llmsTxt ? "llms.txt" : undefined, 0.25);

  return summarize(checks, pages.length);
}

function scoreOf(list: ReadinessCheck[]) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  const got = list.reduce((s, x) => s + x.weight * (x.status === "good" ? 1 : x.status === "improve" ? 0.5 : 0), 0);
  return total ? Math.round((got / total) * 100) : 0;
}

/** Score and group scores from a list of checks (also used when checks stop applying after the owner's corrections). */
export function summarize(checks: ReadinessCheck[], pagesRead: number): Readiness {
  return { score: scoreOf(checks), groups: GROUPS.map((g) => ({ ...g, score: scoreOf(checks.filter((x) => x.group === g.id)) })), checks, pagesRead };
}

/** The most valuable fixes first: missing before improve, then by weight. */
export function topFixes(r: Readiness, n = 3) {
  return r.checks
    .filter((c) => c.status !== "good")
    .sort((a, b) => (a.status === "missing" ? 0 : 1) - (b.status === "missing" ? 0 : 1) || b.weight - a.weight)
    .slice(0, n);
}
