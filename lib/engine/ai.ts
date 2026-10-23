import "server-only";

/*
 * Asks one customer question to ChatGPT (OpenAI Responses API with live web search) — exactly one model call per
 * question. Ported from Ai Ads' lib/openai.ts + lib/measure-ai.ts with three changes:
 *  - the user location is the business's own country/city instead of always the Netherlands;
 *  - the recommended businesses are listed by the same call (on a marked last line) instead of a second
 *    extraction call, so a question never costs more than one call;
 *  - answers in the language of the question (customers ask in their own language).
 * Nothing here runs unless lib/guard.ts allows it.
 */

export const measureModel = () => process.env.OPENAI_MEASURE_MODEL || "gpt-6-luna";

/** USD per 1M tokens [input, output]; unknown models are priced like a mid model to stay on the safe side. */
const PRICES: Record<string, [number, number]> = { "gpt-6-luna": [0.05, 0.25], "gpt-6.1-sol": [1, 5], "gpt-6-astra": [5, 25] };
const SEARCH_USD = () => Number(process.env.OPENAI_SEARCH_PRICE || 0.01);

export function costOf(model: string, u: { input: number; output: number; searches: number }) {
  const [pin, pout] = PRICES[model] || [1, 5];
  return (u.input * pin + u.output * pout) / 1e6 + u.searches * SEARCH_USD();
}

/** Worst case for one question, used to check the daily budget BEFORE a call is made. */
export const maxCostPerQuestion = () => costOf(measureModel(), { input: 12_000, output: 1_200, searches: 1 });

const MARK = "@@BUSINESSES";

const instructions = (country: string, city: string) =>
  `You are a helpful AI assistant. A user${city ? ` in ${city}` : ""}${country ? ` (${country})` : ""} asks you a question. Search the web and give a concrete, honest answer in the language of the question. Where it fits, name specific businesses (with their website if you know it), in the order you would recommend them, with one short reason each. Keep it under 150 words.
After your answer, add one final line that starts with ${MARK} followed by a JSON array of the businesses you recommended, in order, like: ${MARK} [{"name":"…","website":"…"}]. Use [] when you named none. Only real businesses you can visit or hire — no directories, review sites or marketplaces.`;

export interface Asked {
  text: string;
  sources: string[];
  businesses: { name: string; website?: string }[];
  costUsd: number;
  model: string;
}

type OutputItem = { type: string; content?: { type: string; text?: string; annotations?: { type: string; url?: string }[] }[] };

export function splitBusinesses(raw: string): { text: string; businesses: { name: string; website?: string }[] } {
  const i = raw.lastIndexOf(MARK);
  if (i < 0) return { text: raw.trim(), businesses: [] };
  const text = raw.slice(0, i).trim();
  const json = raw.slice(i + MARK.length).trim();
  try {
    const arr = JSON.parse(json.slice(json.indexOf("["), json.lastIndexOf("]") + 1)) as { name?: unknown; website?: unknown }[];
    const businesses = arr
      .filter((b) => b && typeof b.name === "string" && b.name.trim().length > 1)
      .map((b) => ({ name: String(b.name).trim().slice(0, 100), website: typeof b.website === "string" && b.website ? b.website.trim().slice(0, 200) : undefined }))
      .slice(0, 15);
    return { text, businesses };
  } catch {
    return { text, businesses: [] };
  }
}

export async function askLikeCustomer(question: string, where: { country: string; city: string }): Promise<Asked> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const model = measureModel();
  const body: Record<string, unknown> = {
    model,
    instructions: instructions(where.country, where.city),
    input: question,
    max_output_tokens: 1200,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search", search_context_size: "low", user_location: { type: "approximate", country: where.country || "US", ...(where.city ? { city: where.city } : {}) } }],
    tool_choice: "required",
    max_tool_calls: 1,
  };
  const OPTIONAL = ["max_tool_calls", "tool_choice", "reasoning"];
  let json: { output?: OutputItem[]; usage?: { input_tokens?: number; output_tokens?: number } } | null = null;
  // Retries only drop request fields a model refuses (a 400 naming that field); it never sends a second paid answer.
  for (let attempt = 0; attempt <= OPTIONAL.length && !json; attempt++) {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      signal: AbortSignal.timeout(50_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.ok) json = await res.json();
    else {
      const err = (await res.text()).slice(0, 300);
      const bad = res.status === 400 ? OPTIONAL.find((k) => k in body && err.includes(k)) : undefined;
      if (!bad) throw new Error(`OpenAI ${res.status}: ${err}`);
      delete body[bad];
    }
  }
  if (!json) throw new Error("OpenAI: no answer");
  const texts: string[] = [];
  const sources: string[] = [];
  for (const it of json.output || []) {
    if (it.type !== "message") continue;
    for (const c of it.content || []) {
      if (c.type !== "output_text") continue;
      texts.push(c.text || "");
      for (const a of c.annotations || []) if (a.type === "url_citation" && a.url) sources.push(a.url.replace(/([?&])utm_source=[^&]*&?/, "$1").replace(/[?&]$/, ""));
    }
  }
  const usage = { input: json.usage?.input_tokens || 0, output: json.usage?.output_tokens || 0, searches: (json.output || []).filter((i) => i.type === "web_search_call").length };
  const { text, businesses } = splitBusinesses(texts.join("").trim());
  return { text, sources: [...new Set(sources)].slice(0, 12), businesses, costUsd: costOf(model, usage), model: "ChatGPT" };
}

/** Model for profile reading, agents and writing (one call each). */
export const agentModel = () => process.env.OPENAI_AGENT_MODEL || "gpt-6.1-sol";
/** Worst case for one writing call, reserved before it is made. */
export const maxCostPerWrite = (model = agentModel()) => costOf(model, { input: 16_000, output: 3_500, searches: 0 });
/** Model for reading a website on the free scan: cheap, since every visitor triggers it. */
export const profileModel = () => process.env.OPENAI_PROFILE_MODEL || measureModel();

/** One OpenAI call that must answer with a JSON object (no web search). */
export async function aiJson<T>(instructions: string, input: string, maxOutputTokens = 3000, model = agentModel()): Promise<{ data: T; costUsd: number }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const body: Record<string, unknown> = {
    model,
    instructions: instructions + " Reply with one valid JSON object only, no other text.",
    input,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: "low" },
    text: { format: { type: "json_object" } },
  };
  const OPTIONAL = ["reasoning", "text"];
  let json: { output?: OutputItem[]; usage?: { input_tokens?: number; output_tokens?: number } } | null = null;
  for (let attempt = 0; attempt <= OPTIONAL.length && !json; attempt++) {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      signal: AbortSignal.timeout(55_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.ok) json = await res.json();
    else {
      const err = (await res.text()).slice(0, 300);
      const bad = res.status === 400 ? OPTIONAL.find((k) => k in body && err.includes(k)) : undefined;
      if (!bad) throw new Error(`OpenAI ${res.status}: ${err}`);
      delete body[bad];
    }
  }
  if (!json) throw new Error("OpenAI: no answer");
  const text = (json.output || []).filter((i) => i.type === "message").flatMap((i) => i.content || []).filter((c) => c.type === "output_text").map((c) => c.text || "").join("");
  const costUsd = costOf(model, { input: json.usage?.input_tokens || 0, output: json.usage?.output_tokens || 0, searches: 0 });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0) throw new Error("OpenAI: no JSON in answer");
  return { data: JSON.parse(text.slice(start, end + 1)) as T, costUsd };
}

/*
 * Sample answers for development and demos. Clearly fictional businesses, always stored as a "demo" round, never
 * counted as a measurement and never shown without a "sample" label.
 */
export function sampleAnswer(question: string, where: { city: string }, ownName: string, index: number): Asked {
  const place = where.city || "your area";
  const pool = ["Northgate", "Riverside", "Oak & Stone", "Bluebell", "Harbor Point", "Summit", "Maple Street"];
  const pick = (k: number) => `${pool[(index + k) % pool.length]} Studio`;
  const named = index % 4 === 1 ? [pick(0), ownName, pick(2)] : [pick(0), pick(1), pick(2)];
  const text = `Sample answer for "${question}": in ${place}, people often mention ${named.slice(0, -1).join(", ")} and ${named.at(-1)}. (This is sample text for testing the layout, not a real AI answer.)`;
  return { text, sources: [], businesses: named.map((name) => ({ name })), costUsd: 0, model: "Sample" };
}
