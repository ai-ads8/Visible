import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { kvDel, kvGet, kvSet } from "./store";
import { assertPublicHost } from "./engine/fetch";
import type { CmsPlatform } from "./types";

/*
 * Publishing to the owner's own website. Ported from Ai Ads (lib/cms/connect.ts), Visible's own copy:
 *  - WordPress: REST API with an application password (Users → Profile → Application passwords);
 *  - Shopify: Admin GraphQL API, with a Dev Dashboard app (Client ID + secret) or a legacy Admin API token.
 * The login is encrypted with CMS_SECRET (AES-256-GCM), stored apart from the scan and never sent to the browser.
 * Fail closed: without CMS_SECRET, nothing can be connected.
 */

export interface CmsCredentials {
  platform: CmsPlatform;
  site: string;
  user?: string;
  clientId?: string;
  secret: string;
}

export class CmsError extends Error {}

export const cmsEnabled = () => (process.env.CMS_SECRET || "").length >= 32;
const allowPrivate = () => process.env.ALLOW_PRIVATE_SCAN === "1" && process.env.NODE_ENV !== "production";

const KEY = () => {
  if (!cmsEnabled()) throw new CmsError("Publishing to websites isn't switched on yet.");
  return createHash("sha256").update(`visible-cms|${process.env.CMS_SECRET}`).digest();
};

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", KEY(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const KEY_OF = (scanId: string) => `cms-cred:${scanId}`;
export const saveCredentials = (scanId: string, c: CmsCredentials) => kvSet(KEY_OF(scanId), { v: 1, blob: encrypt(JSON.stringify(c)) });
export async function loadCredentials(scanId: string): Promise<CmsCredentials | null> {
  const doc = await kvGet<{ v: number; blob: string }>(KEY_OF(scanId));
  if (!doc?.blob || !cmsEnabled()) return null;
  try {
    return JSON.parse(decrypt(doc.blob)) as CmsCredentials;
  } catch {
    return null;
  }
}
export const deleteCredentials = (scanId: string) => kvDel(KEY_OF(scanId));

/** Normalises the site address; https only (http only for local tests). */
export function normalizeSite(platform: CmsPlatform, raw: string): string {
  let s = raw.trim().replace(/\/+$/, "");
  if (platform === "shopify") {
    s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) && !allowPrivate()) throw new CmsError("Enter your Shopify address as yourstore.myshopify.com.");
    return s;
  }
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new CmsError("Enter your website address, like yourbusiness.com.");
  }
  if (u.protocol !== "https:" && !allowPrivate()) throw new CmsError("Use an https address.");
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
}

async function call(url: string, init: RequestInit = {}): Promise<{ status: number; json: unknown }> {
  const u = new URL(url);
  try {
    await assertPublicHost(u.hostname);
  } catch {
    throw new CmsError("This address isn't publicly reachable.");
  }
  try {
    const r = await fetch(u, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000) });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: r.status, json };
  } catch (e) {
    throw new CmsError(
      (e as Error).name === "TimeoutError" ? "Your website didn't respond in time." : "We couldn't reach your website, or it redirects elsewhere. Enter the address exactly as your browser shows it (with or without www)."
    );
  }
}

type Upsert = { remoteId?: string; title: string; slug: string; html: string; excerpt: string; live: boolean };
type Upserted = { remoteId: string; url?: string; live: boolean };

/* ---------------- WordPress ---------------- */

const wpAuth = (c: CmsCredentials) => `Basic ${Buffer.from(`${c.user}:${c.secret.replace(/\s+/g, "")}`).toString("base64")}`;

function wpError(status: number, json: unknown): never {
  const msg = (json as { message?: string } | null)?.message;
  if (status === 401 || status === 403) throw new CmsError("WordPress refused the login. Check the username and the application password (Users → Profile → Application passwords).");
  if (status === 404) throw new CmsError("We couldn't find the WordPress REST API at this address.");
  throw new CmsError(`WordPress returned an error (${status})${msg ? `: ${String(msg).replace(/<[^>]+>/g, "").slice(0, 160)}` : ""}.`);
}

async function wpTest(c: CmsCredentials): Promise<string> {
  const r = await call(`${c.site}/wp-json/wp/v2/users/me?context=edit`, { headers: { authorization: wpAuth(c), accept: "application/json" } });
  if (r.status !== 200) wpError(r.status, r.json);
  const me = r.json as { name?: string; capabilities?: Record<string, boolean> };
  if (me.capabilities && !me.capabilities.publish_pages) throw new CmsError("This WordPress account can't publish pages. Use an account with the Editor or Administrator role.");
  return me.name || c.user || "WordPress";
}

async function wpUpsert(c: CmsCredentials, p: Upsert): Promise<Upserted> {
  const body = JSON.stringify({ title: p.title, slug: p.slug, content: p.html, excerpt: p.excerpt, status: p.live ? "publish" : "draft" });
  const headers = { authorization: wpAuth(c), "content-type": "application/json", accept: "application/json" };
  let r = await call(p.remoteId ? `${c.site}/wp-json/wp/v2/pages/${encodeURIComponent(p.remoteId)}` : `${c.site}/wp-json/wp/v2/pages`, { method: "POST", headers, body });
  // Deleted on the site in the meantime: create it again.
  if (p.remoteId && r.status === 404) r = await call(`${c.site}/wp-json/wp/v2/pages`, { method: "POST", headers, body });
  if (r.status !== 200 && r.status !== 201) wpError(r.status, r.json);
  const j = r.json as { id: number; link?: string; status?: string };
  return { remoteId: String(j.id), url: j.link, live: j.status === "publish" };
}

/* ---------------- Shopify ---------------- */

const SHOPIFY_VERSION = () => process.env.SHOPIFY_API_VERSION || "2025-07";
const shopBase = (c: CmsCredentials) => `${allowPrivate() && !c.site.endsWith(".myshopify.com") ? "http" : "https"}://${c.site}`;

async function shopifyToken(c: CmsCredentials): Promise<string> {
  if (!c.clientId) return c.secret.trim();
  const r = await call(`${shopBase(c)}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId.trim(), client_secret: c.secret.trim() }).toString(),
  });
  const j = r.json as { access_token?: string; error?: string; error_description?: string } | null;
  if (r.status !== 200 || !j?.access_token) {
    if (r.status === 404) throw new CmsError(`No Shopify store found at ${c.site}. Check the address in Shopify under Settings → Domains.`);
    if (r.status === 400 || r.status === 401) throw new CmsError("Shopify refused the Client ID or secret. Copy them again from your app in the Dev Dashboard, and make sure the app is installed on this store.");
    throw new CmsError(`Shopify didn't give access (${r.status}).`);
  }
  return j.access_token;
}

async function shopifyGql<T>(c: CmsCredentials, query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await call(`${shopBase(c)}/admin/api/${SHOPIFY_VERSION()}/graphql.json`, {
    method: "POST",
    headers: { "x-shopify-access-token": await shopifyToken(c), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (r.status === 401 || r.status === 403) throw new CmsError("Shopify refused access. The app needs the read_content and write_content permissions and must be installed on the store.");
  if (r.status !== 200) throw new CmsError(`Shopify returned an error (${r.status}).`);
  const j = r.json as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new CmsError(`Shopify: ${j.errors[0].message.slice(0, 160)}`);
  return j.data as T;
}

async function shopifyUpsert(c: CmsCredentials, p: Upsert): Promise<Upserted> {
  const input = { title: p.title, handle: p.slug, body: p.html, isPublished: p.live };
  type Res = { page?: { id: string; handle: string; isPublished: boolean } | null; userErrors: { message: string }[] };
  const create = async () => (await shopifyGql<{ pageCreate: Res }>(c, "mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle isPublished } userErrors { message } } }", { page: input })).pageCreate;
  let res: Res;
  if (p.remoteId) {
    res = (await shopifyGql<{ pageUpdate: Res }>(c, "mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id handle isPublished } userErrors { message } } }", { id: p.remoteId, page: input })).pageUpdate;
    if (!res.page) res = await create();
  } else res = await create();
  if (!res.page) throw new CmsError(`Shopify: ${res.userErrors?.[0]?.message || "the page wasn't saved"}.`);
  return { remoteId: res.page.id, url: `https://${c.site}/pages/${res.page.handle}`, live: res.page.isPublished };
}

/* ---------------- entry ---------------- */

export async function testConnection(c: CmsCredentials): Promise<string> {
  if (c.platform === "wordpress") return wpTest(c);
  const d = await shopifyGql<{ shop: { name: string } }>(c, "{ shop { name } }");
  return d.shop?.name || c.site;
}

export const upsertPage = (c: CmsCredentials, p: Upsert) => (c.platform === "wordpress" ? wpUpsert(c, p) : shopifyUpsert(c, p));
