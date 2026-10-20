# What Visible took from Ai Ads (audit of `ai-ads8/ai-ads` @ fa7b579)

Read-only inspection. Nothing in the Ai Ads repository, deployment, database or keys was changed.

## Verified in the code and reused (copied and adapted, not linked)

| Ai Ads file | What it does | In Visible |
|---|---|---|
| `lib/scanner/fetch.ts` | SSRF-safe fetch: private IPs blocked on every redirect, 8 s timeout, 3 MB cap | `lib/engine/fetch.ts` — English messages, neutral language header, `ALLOW_PRIVATE_SCAN` ignored in production |
| `lib/scanner/crawl.ts` | Start page + homepage + best internal page per type, robots.txt, sitemap, llms.txt | `lib/engine/crawl.ts` — max 10 pages; social scraping removed (it used unofficial Instagram endpoints and spoofed crawler user agents) |
| `lib/scanner/extract.ts` | HTML → JSON-LD, meta, headings, links, FAQ-style questions | `lib/engine/extract.ts` — trimmed; page types recognised in 7 languages |
| `lib/openai.ts` + `lib/measure-ai.ts` | OpenAI Responses API + web search, token cost, removing `utm_source` | `lib/engine/ai.ts` — location = the business's own country/city (was always NL) |
| `lib/mentions.ts` | Name matching (legal forms, connectors) | `lib/engine/mentions.ts` — international word lists |
| `lib/gratis-check.ts` + `lib/scanner/sitecheck.ts` | Free €0 website check with evidence per finding | Idea reused; `lib/engine/readiness.ts` rebuilt in English with language-neutral checks (the Ai Ads checks are Dutch regexes per branche) |
| `server/env.ts` | Fail-closed configuration | `server/env.ts`, same pattern |
| `lib/store.ts` | Upstash REST / JSON-file storage | `lib/store.ts` — every key prefixed `visible:`, own database required |

Not reused: Dutch marketing site and content, client portal, admin, monthly reports, visitor counter, GA4/Google Places, WordPress/Shopify CMS publishing, cold-sales tools.

## Safeguards from the brief that did NOT exist in Ai Ads

| Brief says | Found in Ai Ads | Visible |
|---|---|---|
| Max 20 questions per round | `MEASURE_QUESTIONS` env (default 10), no upper bound | Hard cap 20 in code (`lib/guard.ts`) |
| One model call per question | Two calls: answer + a second extraction call | One call; businesses listed on a marked last line |
| Sequential execution | Comment in `measure/route.ts` says questions run *in parallel* from the browser | Server lock per round; one question per request |
| Daily usage limits | None (only per-IP scan rate limit) | Daily USD budget + daily question cap, reserved before each call |
| One official round per day | None | Enforced per business per day |
| Dev tests excluded from scores | None | Sample rounds stored as `demo`, never in history |
| Audit logging | None | `lib/audit.ts`, visible in `/admin` |
| `lib/actor.ts`, `docs/architecture/` (named in Ai Ads' CLAUDE.md) | Do not exist | — |

Worth fixing in Ai Ads itself at some point (not done here, Ai Ads was left untouched): the uncapped question count, parallel measuring, and the missing daily spend cap.
