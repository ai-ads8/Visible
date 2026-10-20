import "server-only";
import { kvList, kvPush } from "./store";

/*
 * Audit log: every measurement start, every paid call, refusals by the safeguards, logins, plan changes and admin
 * actions. Never contains secrets, passwords or full AI answers.
 */

export interface AuditEvent {
  at: string;
  event: string;
  actor: string;
  detail?: Record<string, string | number | boolean | undefined>;
}

export async function audit(event: string, actor: string, detail?: AuditEvent["detail"]) {
  const row: AuditEvent = { at: new Date().toISOString(), event, actor, detail };
  console.info("audit", event, actor, JSON.stringify(detail || {}));
  try {
    await kvPush("audit", row, 2000);
  } catch (e) {
    console.error("audit write failed", e);
  }
}

export const recentAudit = (n = 100) => kvList<AuditEvent>("audit", n);
