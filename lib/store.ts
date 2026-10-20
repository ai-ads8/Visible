import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/*
 * Tiny key-value layer: Upstash Redis (REST) in production, JSON files locally.
 * Every key is prefixed with "visible:" and Visible must use its OWN Redis database, never the Ai Ads one,
 * so customer records of the two products can never mix.
 */

const PREFIX = "visible:";
const DATA_DIR = process.env.DATA_DIR || ".data";

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
export const useRedis = () => !!(redisUrl() && redisToken());
export const storageMode = () => (useRedis() ? "redis" : "files");

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(redisUrl(), {
    method: "POST",
    headers: { authorization: `Bearer ${redisToken()}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || json.error) throw new Error(`Redis: ${json.error || res.status}`);
  return json.result;
}

/* ---------------- file fallback (local development only) ---------------- */

type FileRow = { v: unknown; exp?: number };
const fileOf = (key: string) => path.join(DATA_DIR, "kv", createHash("sha256").update(key).digest("hex").slice(0, 40) + ".json");
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}
async function fread(key: string): Promise<FileRow | null> {
  try {
    const row = JSON.parse(await fs.readFile(fileOf(key), "utf8")) as FileRow;
    if (row.exp && row.exp < Date.now()) return null;
    return row;
  } catch {
    return null;
  }
}
async function fwrite(key: string, row: FileRow) {
  await fs.mkdir(path.join(DATA_DIR, "kv"), { recursive: true });
  await fs.writeFile(fileOf(key), JSON.stringify(row));
}

/* ---------------- public API ---------------- */

export async function kvGet<T>(key: string): Promise<T | null> {
  const k = PREFIX + key;
  if (useRedis()) {
    const v = (await redis(["GET", k])) as string | null;
    return v ? (JSON.parse(v) as T) : null;
  }
  return ((await fread(k))?.v as T) ?? null;
}

export async function kvSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const k = PREFIX + key;
  if (useRedis()) {
    await redis(ttlSeconds ? ["SET", k, JSON.stringify(value), "EX", ttlSeconds] : ["SET", k, JSON.stringify(value)]);
    return;
  }
  await withLock(k, () => fwrite(k, { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined }));
}

/** Sets only when the key does not exist yet (a lock or a claim). Returns true when this call set it. */
export async function kvSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const k = PREFIX + key;
  if (useRedis()) return (await redis(["SET", k, value, "NX", "EX", ttlSeconds])) === "OK";
  return withLock(k, async () => {
    if (await fread(k)) return false;
    await fwrite(k, { v: value, exp: Date.now() + ttlSeconds * 1000 });
    return true;
  });
}

export async function kvDel(key: string): Promise<void> {
  const k = PREFIX + key;
  if (useRedis()) await redis(["DEL", k]);
  else await fs.rm(fileOf(k), { force: true });
}

/** Atomic counter; the expiry is set when the counter is created. */
export async function kvIncr(key: string, by: number, ttlSeconds: number): Promise<number> {
  const k = PREFIX + key;
  if (useRedis()) {
    const n = Number(await redis(["INCRBYFLOAT", k, by]));
    if (n === by) await redis(["EXPIRE", k, ttlSeconds]);
    return n;
  }
  return withLock(k, async () => {
    const row = await fread(k);
    const n = Number(row?.v || 0) + by;
    await fwrite(k, { v: n, exp: row?.exp ?? Date.now() + ttlSeconds * 1000 });
    return n;
  });
}

/** Prepends to a capped list (newest first). */
export async function kvPush<T>(key: string, value: T, max: number): Promise<void> {
  const k = PREFIX + key;
  if (useRedis()) {
    await redis(["LPUSH", k, JSON.stringify(value)]);
    await redis(["LTRIM", k, 0, max - 1]);
    return;
  }
  await withLock(k, async () => {
    const list = ((await fread(k))?.v as T[]) || [];
    await fwrite(k, { v: [value, ...list].slice(0, max) });
  });
}

export async function kvList<T>(key: string, limit: number): Promise<T[]> {
  const k = PREFIX + key;
  if (useRedis()) return ((await redis(["LRANGE", k, 0, limit - 1])) as string[]).map((s) => JSON.parse(s) as T);
  return (((await fread(k))?.v as T[]) || []).slice(0, limit);
}

/** Counter for rate limits: hits within a fixed window. */
export async function hit(key: string, windowSeconds: number): Promise<number> {
  return kvIncr(`rl:${key}`, 1, windowSeconds);
}

export const today = () => new Date().toISOString().slice(0, 10);
