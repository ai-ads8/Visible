import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/*
 * Safe page fetching, carried over from Ai Ads (lib/scanner/fetch.ts): SSRF protection re-checked on every redirect,
 * manual redirects, timeout and size cap. Messages translated to English, browser language made neutral.
 */

const UA = "Mozilla/5.0 (compatible; VisibleScanner/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;

export class ScanError extends Error {
  constructor(message: string, public userMessage: string) {
    super(message);
  }
}

const allowPrivate = () => process.env.ALLOW_PRIVATE_SCAN === "1" && process.env.NODE_ENV !== "production";

export function normalizeInputUrl(raw: string): URL {
  let value = (raw || "").trim();
  if (!value) throw new ScanError("empty", "Enter your website to start.");
  if (!/^https?:\/\//i.test(value)) value = "https://" + value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ScanError("invalid url", "That doesn't look like a website address. Check the spelling.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new ScanError("protocol", "Only http and https websites can be scanned.");
  if (!url.hostname.includes(".") && !allowPrivate()) throw new ScanError("no tld", "Enter a full address, for example yourbusiness.com.");
  url.hash = "";
  return url;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

export async function assertPublicHost(hostname: string) {
  if (allowPrivate()) return;
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new ScanError("private host", "This address isn't publicly reachable.");
  let addresses: string[] = [];
  if (net.isIP(host)) addresses = [host];
  else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new ScanError("dns", "We couldn't find this website. Check the address.");
    }
  }
  if (addresses.some(isPrivateIp)) throw new ScanError("private ip", "This address isn't publicly reachable.");
}

export interface FetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

export async function safeFetch(input: string | URL, opts: { accept?: string; maxBytes?: number } = {}): Promise<FetchResult> {
  let current = new URL(input.toString());
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current.hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": UA, Accept: opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "en;q=0.9,*;q=0.5" },
        cache: "no-store",
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = (e as Error)?.name === "AbortError";
      throw new ScanError("fetch failed: " + (e as Error)?.message, aborted ? "Your website took too long to respond. Try again in a minute." : "We couldn't open this website. Check the address and try again.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      current = new URL(res.headers.get("location")!, current);
      if (!["http:", "https:"].includes(current.protocol)) throw new ScanError("bad redirect", "This website redirects to an invalid address.");
      continue;
    }
    const contentType = res.headers.get("content-type") || "";
    const body = await readCapped(res, opts.maxBytes ?? MAX_BYTES).finally(() => clearTimeout(timer));
    return { url: current.toString(), status: res.status, contentType, body };
  }
  throw new ScanError("too many redirects", "This website redirects too many times.");
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      chunks.push(value.slice(0, value.byteLength - (total - max)));
      try {
        await reader.cancel();
      } catch {}
      break;
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const charset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") || "")?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}
