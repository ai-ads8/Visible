import { z } from "zod";

/*
 * Every secret Visible needs, validated once. Fail closed: a missing or weak value stops the app instead of falling
 * back to a guessable default. Pattern carried over from Ai Ads (server/env.ts), with Visible's own variables.
 * Edge-safe: no Node-only imports.
 */

const secret = (name: string) => z.string({ required_error: `${name} is missing` }).min(32, `${name} must be at least 32 characters`);

const schema = z
  .object({
    /** Signs login sessions. */
    SESSION_SECRET: secret("SESSION_SECRET"),
    /** Only the scheduler that sends `Authorization: Bearer <CRON_SECRET>` may start scheduled checks. Optional. */
    CRON_SECRET: secret("CRON_SECRET").optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    KV_REST_API_URL: z.string().url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    VERCEL: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    const redis = (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) || (e.KV_REST_API_URL && e.KV_REST_API_TOKEN);
    // On Vercel the file fallback would write to /tmp and lose data silently.
    if (e.VERCEL && !redis) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Storage missing: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (a database used only by Visible)" });
  });

export type Env = z.infer<typeof schema>;
export class EnvError extends Error {}

let cached: Env | null = null;

export function parseEnv(vars: Record<string, string | undefined>): Env {
  const r = schema.safeParse(vars);
  if (!r.success) throw new EnvError(`Visible cannot start, the configuration is incomplete:\n- ${r.error.issues.map((i) => i.message).join("\n- ")}`);
  return r.data;
}

export function env(): Env {
  return (cached ??= parseEnv(process.env));
}
