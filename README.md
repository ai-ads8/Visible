# Visible

Self-service AI visibility for small businesses, in English, for any country.
**"Your competitors show up in AI. Do you?"**

A visitor enters their website → Visible reads it (free, no AI cost) → the owner confirms what they do and where → Visible asks ChatGPT (with live web search) the questions their customers ask → they see whether AI names them, who it names instead, and what to fix.

Completely separate from Ai Ads: own code, own deployment, own database, own accounts, own billing. See `docs/AI_ADS_AUDIT.md` for what was reused and what was found.

## What's in it

- **Homepage** (`/`) — hero with scan box, how it works, example report (labelled, fictional names), pricing, FAQ.
- **Scan** (`/scan/new` → `/scan/[id]`) — website readiness score (4 groups, ~22 checks, evidence per finding), confirm-your-details step, live AI check with dots filling in per question, "who AI recommends" ranking, real answers, fix list.
- **Free vs paid** — free shows the score, all dots, top 3 competitors, 1 full answer and the top 3 fixes. Locked parts are **left out by the server**, not just blurred.
- **Accounts** (`/signup`, `/signin`, `/dashboard`) — email + password (scrypt), signed session cookie; a scan is saved to the account on sign-up. Saved scans are private.
- **Billing** (`/pricing`) — Stripe Checkout + Customer Portal + signed webhook. Plans in `lib/plans.ts` (Free, Starter €19, Growth €29, Pro €49).
- **Scheduled checks** — `/api/cron/checks` (Vercel Cron, daily) for paid plans: daily or weekly per plan.
- **Admin** (`/admin`, emails in `ADMIN_EMAILS`) — AI mode, today's spend vs budget, safeguards, audit log.

## Cost safeguards (all server-side, `lib/guard.ts`)

- **No paid call unless** `OPENAI_API_KEY` is set **and** `VISIBLE_LIVE_MEASUREMENTS=on`. Without it, production shows "AI check almost ready" and never fakes results.
- Max **20 questions** per check (hard-coded), **one model call** per question, **one question at a time** (lock).
- **One official check per business per day**; free: once per scan, `FREE_ROUNDS_PER_IP` per visitor per day, `FREE_ROUNDS_PER_DAY` in total.
- **Daily budget** (`DAILY_BUDGET_USD`, default $3) and question cap (`DAILY_QUESTION_LIMIT`, default 150): the worst-case cost is reserved *before* each call; when the budget is gone, checks pause until tomorrow.
- Same question + place within 7 days reuses the saved answer at no cost.
- Test mode (local dev, or `VISIBLE_DEMO=on`) uses clearly labelled sample answers that are never counted.
- Every check, paid call, refusal, login and plan change goes to the audit log.

With the default model (`gpt-6-luna`), a 5-question free check costs about **$0.05**, almost all of it web search.

## Run locally

```bash
npm install
cp .env.example .env.local   # set SESSION_SECRET (openssl rand -base64 48)
npm run dev                  # http://localhost:3000 — test mode, sample answers
npm test                     # offline tests, no network
```

## Deploy to Vercel (new project — never the Ai Ads project)

1. **Make a new GitHub repo** (e.g. `visible`) and push this folder to it.
2. **Vercel → Add New → Project → import that repo.** Framework: Next.js (auto). Name it `visible` so the URL becomes `visible-<something>.vercel.app`.
3. **Storage:** in the new project, Storage → Create → **Upstash Redis** → a **new** database (not Ai Ads'). Connect it; Vercel adds the `KV_REST_API_*` variables.
4. **Environment variables** (Settings → Environment Variables):
   - `SESSION_SECRET` — new value: `openssl rand -base64 48`
   - `NEXT_PUBLIC_SITE_URL` — the project URL
   - `ADMIN_EMAILS` — your email
   - `CRON_SECRET` — another new random value
5. **Deploy.** Open the URL, run a scan, create an account with your admin email, open `/admin`.
6. **Switch on real AI checks** when you're ready: add `OPENAI_API_KEY` (a **new key** made for Visible, so usage is separate from Ai Ads), `VISIBLE_LIVE_MEASUREMENTS=on`, and optionally `DAILY_BUDGET_USD`. Redeploy. Also set a monthly usage limit on the key in the OpenAI dashboard as a second safety net.
7. **Payments:** in Stripe create one product with three monthly prices (€19/€29/€49), then set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`. Add a webhook to `https://<your-url>/api/billing/webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`. Turn on the Customer Portal in Stripe settings.

## Not done yet / decide before launch

- Privacy and terms pages are drafts.
- Questions are asked in English for every country. Asking in the customer's own language (e.g. Dutch for NL) would be more realistic; it's a small change in `lib/engine/questions.ts`.
- Only ChatGPT is measured. The site says so honestly; add others before claiming them.
- No password reset email yet (needs an email provider).
- The free AI check needs live mode; until then visitors get the free website check only.
