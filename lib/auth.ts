import "server-only";
import { createHash, createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { env } from "@/server/env";
import { kvGet, kvSet, kvSetNx } from "./store";
import type { PlanId } from "./plans";

/*
 * Visible's own accounts: email + password (scrypt), signed session cookie. Nothing is shared with Ai Ads.
 * The owner/admin is whoever's email is listed in ADMIN_EMAILS.
 */

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION = "visible_session";
const VISITOR = "visible_visitor";
const MAX_AGE = 60 * 60 * 24 * 30;

export interface User {
  id: string;
  email: string;
  pwHash: string;
  plan: PlanId;
  createdAt: string;
  scanIds: string[];
  stripeCustomerId?: string;
  subscriptionStatus?: string;
}

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const emailKey = (email: string) => `user-email:${sha(email.trim().toLowerCase())}`;
export const newId = (bytes = 12) => randomBytes(bytes).toString("base64url");

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `s1$${salt.toString("hex")}$${(await scrypt(pw, salt, 32)).toString("hex")}`;
}
export async function checkPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const got = await scrypt(pw, Buffer.from(salt, "hex"), 32);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

export const getUser = (id: string) => kvGet<User>(`user:${id}`);
export const saveUser = (u: User) => kvSet(`user:${u.id}`, u);
export async function userByEmail(email: string) {
  const id = await kvGet<string>(emailKey(email));
  return id ? getUser(id) : null;
}

export async function createUser(email: string, password: string): Promise<User | null> {
  const id = newId();
  if (!(await kvSetNx(emailKey(email), id, 60 * 60 * 24 * 365 * 20))) return null; // email taken
  const user: User = { id, email: email.trim().toLowerCase(), pwHash: await hashPassword(password), plan: "free", createdAt: new Date().toISOString(), scanIds: [] };
  await saveUser(user);
  return user;
}

const sign = (v: string) => createHmac("sha256", env().SESSION_SECRET).update(v).digest("base64url");

export async function startSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const v = `${userId}.${exp}`;
  (await cookies()).set(SESSION, `${v}.${sign("s:" + v)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(SESSION);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(SESSION)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  const want = sign(`s:${id}.${exp}`);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  return getUser(id);
}

export const isAdmin = (u: User | null) =>
  !!u && (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(u.email);

/** Anonymous visitor key (cookie), so a visitor can run the free check on the scan they started. Only its hash is stored. */
export async function visitorHash(create = false): Promise<string | null> {
  const jar = await cookies();
  let v = jar.get(VISITOR)?.value;
  if (!v && create) {
    v = newId(18);
    jar.set(VISITOR, v, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  }
  return v ? sha("v:" + v) : null;
}

export function clientIpHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  return sha("ip:" + ip).slice(0, 32);
}
