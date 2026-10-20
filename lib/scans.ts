import "server-only";
import { kvGet, kvSet } from "./store";
import { newId, type User } from "./auth";
import type { CompetitorRow, Round, Scan } from "./types";
import { sameBusiness } from "./engine/mentions";

export const getScan = (id: string) => kvGet<Scan>(`scan:${id}`);
export async function saveScan(s: Scan) {
  s.updatedAt = new Date().toISOString();
  await kvSet(`scan:${s.id}`, s);
}
export const newScanId = () => newId(12);

export const getRound = (id: string) => kvGet<Round>(`round:${id}`);
export const saveRound = (r: Round) => kvSet(`round:${r.id}`, r);

/** Who may act on a scan: its account owner, or (before it is saved to an account) the visitor who started it. */
export function canControl(scan: Scan, user: User | null, visitor: string | null) {
  if (scan.ownerId) return !!user && user.id === scan.ownerId;
  return !!visitor && visitor === scan.visitorHash;
}

/** Recommended businesses across a round, most-mentioned first; the own business is always included. */
export function competitorTable(scan: Scan, round: Round | null): CompetitorRow[] {
  const rows: CompetitorRow[] = [];
  for (const a of round?.answers || []) {
    const seen = new Set<string>();
    for (const b of a.businesses) {
      const isYou = sameBusiness(b.name, scan.profile.name);
      const row = isYou ? rows.find((r) => r.isYou) : rows.find((r) => !r.isYou && sameBusiness(r.name, b.name));
      const key = isYou ? "__you" : (row?.name || b.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (row) row.count++;
      else rows.push({ name: isYou ? scan.profile.name : b.name, website: b.website, count: 1, isYou });
    }
    if (a.mention === "named" && !a.businesses.some((b) => sameBusiness(b.name, scan.profile.name)) && !seen.has("__you")) {
      const you = rows.find((r) => r.isYou);
      if (you) you.count++;
      else rows.push({ name: scan.profile.name, count: 1, isYou: true });
    }
  }
  if (!rows.some((r) => r.isYou)) rows.push({ name: scan.profile.name, count: 0, isYou: true });
  return rows.sort((a, b) => b.count - a.count || Number(b.isYou) - Number(a.isYou));
}
