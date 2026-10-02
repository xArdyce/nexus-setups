import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

type Action = "login" | "reset-request" | "reset-confirm" | "signup" | "password-change";
const policies = {
  signup: { seconds: 3600, account: 3, ip: 20 },
  "password-change": { seconds: 900, account: 10, ip: 100 },
  login: { seconds: 900, account: 10, ip: 100 },
  "reset-request": { seconds: 3600, account: 3, ip: 20 },
  "reset-confirm": { seconds: 900, account: 10, ip: 100 },
} as const;

async function consume(key: string, seconds: number, limit: number) {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, clock_timestamp() + ${seconds} * interval '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= clock_timestamp()
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= clock_timestamp()
        THEN clock_timestamp() + ${seconds} * interval '1 second'
        ELSE "RateLimit"."expiresAt" END
    WHERE "RateLimit"."expiresAt" <= clock_timestamp() OR "RateLimit"."count" < ${limit}
    RETURNING "count"
  `;
  return rows.length === 1;
}

export async function allowAuthAttempt(action: Action, identity: string, request: Request) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Auth rate-limit secret is not configured.");
  const key = (scope: string, value: string) => createHmac("sha256", secret)
    .update(`${action}:${scope}:${value}`).digest("hex");
  const policy = policies[action];
  const ip = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  if (ip && isIP(ip) && !(await consume(key("ip", ip), policy.seconds, policy.ip))) {
    return false;
  }
  const allowed = await consume(key("account", identity), policy.seconds, policy.account);
  await prisma.$executeRaw`
    DELETE FROM "RateLimit" WHERE "key" IN (
      SELECT "key" FROM "RateLimit" WHERE "expiresAt" < clock_timestamp() - interval '1 day'
      ORDER BY "expiresAt" LIMIT 100
    )
  `;
  return allowed;
}
