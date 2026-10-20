import type { BusinessProfile, Question } from "@/lib/types";

/*
 * Customer questions, written the way a real customer asks an AI assistant — never mentioning the business itself.
 * Deterministic templates (no AI call, €0), built from the profile the owner confirmed. The same profile always
 * gives the same questions in the same order, so rounds stay comparable over time.
 */

const plural = (w: string) => {
  const last = w.split(" ").pop() || w;
  if (/(s|sh|ch|x|z)$/.test(last)) return w + "es";
  if (/[^aeiou]y$/.test(last)) return w.slice(0, -1) + "ies";
  return w + "s";
};

function hashId(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return "q" + (h >>> 0).toString(36);
}

export function buildQuestions(p: BusinessProfile, max = 20): Question[] {
  const cat = (p.category || "business").toLowerCase().trim();
  const cats = plural(cat);
  const svc = p.service.toLowerCase().trim();
  const place = p.city.trim();
  const list: [string, string][] = [];

  if (p.reach === "local" && place) {
    list.push(
      ["Best in town", `What's the best ${cat} in ${place}?`],
      ["Recommendation", `Can you recommend a good ${cat} in ${place}?`],
      ["Reviews", `Which ${cat} in ${place} has the best reviews?`],
      ["Top list", `What are the top ${cats} in ${place}?`],
      ["Trust", `Which ${cat} in ${place} do locals trust most?`]
    );
    if (svc) list.push(["Service", `Where can I get ${svc} in ${place}?`], ["Service", `Who is the best for ${svc} in ${place}?`]);
    list.push(
      ["Price", `Is there an affordable ${cat} in ${place}?`],
      ["Quality", `I want a high-quality ${cat} in ${place}. Who should I choose?`],
      ["Availability", `Which ${cat} in ${place} can help me this week?`],
      ["Newcomer", `I just moved to ${place}. Which ${cat} would you recommend?`],
      ["Families", `Which ${cat} in ${place} is good for families?`],
      ["Compare", `Compare the best ${cats} in ${place} for me.`]
    );
    if (svc) list.push(["Price", `How much does ${svc} cost in ${place}, and where should I go?`]);
    list.push(["Near me", `I'm in ${place} and need a ${cat}. What are my best options?`], ["Experience", `Which ${cat} in ${place} has the most experience?`]);
  } else {
    const what = svc || cats;
    list.push(
      ["Best online", `What's the best online ${cat}?`],
      ["Where to buy", `Where can I buy ${what} online?`],
      ["Reviews", `Which ${cat} has the best reviews?`],
      ["Top list", `What are the top ${cats} right now?`],
      ["Recommendation", `Can you recommend a reliable ${cat}?`],
      ["Price", `What's a good ${cat} that isn't too expensive?`],
      ["Quality", `Which ${cat} has the best quality ${what}?`],
      ["Compare", `Compare the most popular ${cats} for me.`],
      ["Gift", `Where should I buy ${what} as a gift?`],
      ["Trust", `Which ${cat} can I trust with my order?`]
    );
  }
  const seen = new Set<string>();
  return list
    .filter(([, t]) => !seen.has(t) && !!seen.add(t))
    .slice(0, max)
    .map(([intent, text]) => ({ id: hashId(text.toLowerCase()), text, intent }));
}
