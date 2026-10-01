# Production hardening report — 2026-09-29

Code-side hardening is implemented locally. No deployment, production database mutation, migration application, secret rotation, admin-script execution, SMTP email delivery to a real account, or Cloudflare configuration change was performed. Apply the migration before releasing this code. External setup and authenticated production testing remain required.

## 1. Changes and behavior

| Area | Result |
| --- | --- |
| Reset email | Generic Nodemailer SMTP transport, entirely environment-configured; text + HTML link, exact requested subject and 30-minute expiry notice. TLS verification remains enabled; STARTTLS is mandatory when SMTP_SECURE=false. Network timeouts are bounded and SMTP debug logging is disabled. |
| Generic responses | Known, unknown, throttled and delivery-failure cases return the same HTTP 200 message. SMTP is attempted only for matching accounts. Missing/invalid request input gets 400. This is response parity, not a claim of constant-time account lookup or SMTP processing. |
| Reset URL | AUTH_URL → NEXTAUTH_URL → request origin. Production requires HTTPS. Only NODE_ENV=development receives debugResetUrl. No environment logs raw links or tokens. |
| Single use | A transaction locks the user, conditionally claims the token with usedAt=null and expiresAt>now, requires affected count=1, then changes the password and deletes other unused tokens. Failure rolls back the claim. The pre-read is only an optimization; it does not authorize consumption. Issuance also takes the same user lock. |
| Hashes/expiry | Tokens remain 32 random bytes, stored only as SHA-256; TTL remains 30 minutes. Password hashing remains bcrypt cost 12. |
| Session revocation | User.sessionVersion increments on reset, settings password change and explicit admin password change. Auth.js checks this version against the JWT on session access and rejects old sessions/deleted users. Legacy JWTs use version 0 until a password change. |
| Rate limits | Shared PostgreSQL atomic upserts, with HMAC-hashed identities and bounded expired-row cleanup; no in-memory-only protection or new service. Login, reset request and reset confirm are protected. Errors fail closed. |
| Remember me | Accessible, unchecked login checkbox uses existing Nexus checkbox styles, passing true/false through existing credentials auth. Eight-hour and 30-day lifetimes are preserved. |
| Admin script | Requires ADMIN_INITIAL_PASSWORD, validates 12-character minimum / 72-byte maximum, never prints credentials, refuses existing accounts without --update-existing-password, warns in production. Creates instead of upserts to avoid race-based overwrites. Existing workspace roles are unchanged. |
| ZIP | One R2 source is opened and consumed at a time. Streaming remains in memory-bounded Node/Web streams without buffering the full ZIP or using disk. Source, archive and finalize errors terminate the response; client/request cancellation aborts fetches and destroys active streams. |
| ZIP audit | Existing action and approved/supporting content selection are preserved. Metadata explicitly says transferStatus=initiated. Audit creation happens before R2 streams open; a failed audit does not leave source streams open. Completion is never claimed. |
| Logging/errors | API catches use a safe logger that emits a static operation label and allowlisted error code only. Messages, stacks, causes, provider payloads, URLs and credentials are not serialized. Auth.js default error/debug logging is overridden. Otherwise unhandled API failures get generic 500 responses. Maintenance script error/email logging was sanitized. |

Reset email sending is awaited inside the request, rather than using an untracked background promise. SMTP failure records a safe operational error and returns the generic response. There is no durable email retry queue. Monitor delivery failures and test sender/provider configuration.

## 2. Rate-limit policies and migration

| Operation | Identity limit | Vercel client-IP limit | Window |
| --- | --- | --- | --- |
| Credentials login | 10 per normalized email | 100 | 15 minutes |
| Reset request | 3 per normalized email | 20 | 1 hour |
| Reset confirmation | 10 per token | 100 | 15 minutes |

Every attempt counts, including successes; counters reset after the first-hit window expires. These limits deliberately permit temporary lockout under abuse. Login returns the normal credentials failure when throttled; reset request stays generic. HMAC uses AUTH_SECRET or its legacy fallback and stores no raw email/IP/token in RateLimit. Only Vercel's client-IP header is trusted when VERCEL=1; elsewhere (or with a missing/invalid header) identity limits still apply. There is no global DDoS guarantee: validate the trusted header in the actual deployment/proxy setup and use platform traffic controls for volumetric attacks.

Migration: `prisma/migrations/20260929120000_auth_hardening/migration.sql` adds:

- `User.sessionVersion INTEGER NOT NULL DEFAULT 0`.
- `RateLimit` with primary key `key`, `count`, `expiresAt`, and expiry index.

This is additive, with no data reset or role change. Apply to isolated staging first, then use the controlled production release process **before deploying the new app**:

```sh
npx prisma migrate deploy
```

The installed Prisma 7.9.1 CLI's `migrate deploy --help` was checked and confirms it applies pending production/staging migrations from prisma.config.ts. Only help and schema validation were run; no migration was applied. Runtime and CLI currently use DATABASE_URL. Use Neon pooled TLS connections at runtime; supply the appropriate migration connection in the migration process environment if your setup requires a direct connection. No connection value was edited. Build remains `prisma generate && next build`; Prisma Studio is not a runtime dependency.

## 3. Exact environment inventory and Vercel scopes

Names only below; `.env.example` contains placeholders, not credentials.

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| DATABASE_URL | Required, production Neon pooled/TLS | Required, isolated Preview DB | Required, isolated dev DB |
| AUTH_SECRET | Required (or NEXTAUTH_SECRET) | Required, separate secret | Required for auth/rate limits |
| R2_ACCOUNT_ID | Required for assets/delivery | Required for asset tests | Required for asset tests |
| R2_ACCESS_KEY_ID | Required, bucket-scoped | Isolated bucket credential | Dev bucket credential |
| R2_SECRET_ACCESS_KEY | Required, server only | Server only | Server only |
| R2_BUCKET_NAME | Required | Isolated Preview bucket | Dev bucket |
| SMTP_HOST | Required for reset mail | Required for mail tests, use test provider/account | Optional; leave empty for debug-link-only testing |
| SMTP_PORT | Required for reset mail | Required when SMTP enabled | Required when SMTP enabled |
| SMTP_SECURE | Required, true or false | Required when SMTP enabled | Required when SMTP enabled |
| SMTP_USER | Required for reset mail | Test SMTP username | Required when SMTP enabled |
| SMTP_PASS | Required for reset mail | Test SMTP credential | Required when SMTP enabled |
| SMTP_FROM | Required, provider-authorized sender | Authorized test sender | Required when SMTP enabled |
| AUTH_URL | Recommended canonical HTTPS production origin | Actual intended Preview origin, or omit for detection | http://localhost:3000 or omit |
| NEXTAUTH_SECRET | Optional legacy alternative to AUTH_SECRET | Optional legacy alternative | Optional legacy alternative |
| NEXTAUTH_URL | Optional legacy fallback for AUTH_URL | Optional, never a production/local override | Optional legacy fallback |
| NODE_ENV | Framework-managed production | Framework-managed production | Framework-managed development |
| VERCEL | Platform-managed, used for trusted IP handling | Platform-managed | Do not spoof locally |
| ADMIN_INITIAL_PASSWORD | Operator-only; not a deployment/runtime variable | Not required | Only for an intentional admin operation |

No NEXT_PUBLIC_ secret, separate DIRECT_URL, new rate-limit credential, custom storage URL or email vendor account variable was introduced. AUTH_TRUST_HOST is not needed because trustHost=true is explicit. Auth.js also supports optional AUTH_SECRET_1 through AUTH_SECRET_3 rotation keys and AUTH_REDIRECT_PROXY_URL, neither required for this credentials-only app.

Vercel checklist:

1. Project → Settings → Environment Variables: add the required Production values and set AUTH_URL to https://nexus-setups.vercel.app.
2. Configure Preview separately with isolated DB/bucket/SMTP and a matching URL override (or host detection). Do not copy a production AUTH_URL to every Preview.
3. Development values belong in the ignored local .env/.env.local or the Development scope for local pulls. Never copy real values into .env.example.
4. NODE_ENV and VERCEL are managed by the platform/framework. Do not add ADMIN_INITIAL_PASSWORD to routine Vercel runtime environments.
5. Deploy/redeploy through the normal workflow after environment changes and successful migration.

`.env` and `.env.local` are verified ignored. `.env.example` is explicitly allowed by .gitignore. Deployed environment values/scopes were not changed or reverified; the earlier Vercel project-details connector had conflicting projectId/idOrName schemas.

## 4. SMTP manual setup

Choose your SMTP service/account; no vendor account was provisioned. Authorize SMTP_FROM and configure SPF/DKIM/domain verification as required by that provider. Set all six SMTP fields. Use 587/false for STARTTLS or 465/true for immediate TLS; certificate checks are never disabled. Preview uses a test sender/inbox. Confirm provider acceptance and inbox delivery, spam placement, subject, 30-minute notice and correct HTTPS link before enabling recovery for real users.

Development with SMTP_HOST omitted skips SMTP and exposes the existing explicit debug URL only under NODE_ENV=development. Preview/production never expose it. SMTP failures do not expose account existence via response content/status. A generic success is not evidence of email receipt.

## 5. R2 security and exact manual CORS steps

The existing server authorization for content, asset/version access, deletion and registration remains unchanged. R2 credentials remain server-only. Signed PUT URLs last 15 minutes and signed GET URLs last five minutes. Upload registration checks the project-owned storage prefix, duplicates and HeadObject; version targets are authorized. R2 remains the persistent asset store; no public bucket or filesystem architecture was introduced.

1. Open Cloudflare dashboard → R2 Object Storage → select the bucket matching R2_BUCKET_NAME.
2. Open Settings → CORS Policy → Add/Edit policy → JSON.
3. Paste the repository's R2_CORS.json. Required exact origins are:
   - https://nexus-setups.vercel.app
   - http://localhost:3000 (if local testing uses this bucket)
4. Add each intended Preview origin explicitly, including https:// and no trailing path. Avoid a wildcard origin.
5. Keep GET, PUT, HEAD; AllowedHeaders=["*"]; ExposeHeaders=["ETag"]; MaxAgeSeconds=3600. Save.
6. Test actual browser upload from Production and each permitted Preview/development origin; inspect OPTIONS/PUT responses. Also test inline/download/version access. A signed URL alone does not bypass browser CORS.

Repository files were updated; **Cloudflare was not changed**. See [Cloudflare CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## 6. Delivery duration and remaining stream limits

The route explicitly uses Node.js. Next.js/Vercel supports a static route-level maxDuration export, but the project's actual plan, Fluid Compute setting and configured limit could not be established from repository configuration. No duration value was guessed and vercel.json was not expanded. In Vercel project Settings → Functions, verify runtime/compute settings and the plan's duration limit, then choose a supported route value if required. See [Vercel duration configuration](https://vercel.com/docs/functions/configuring-functions/duration).

Cancellation cleanup handles request abort and Web response cancellation, including an in-flight GetObject. Archive errors and finalize rejections are handled; late failures terminate the stream rather than append a JSON error to a ZIP. After headers are sent, the HTTP status may already be 200: validate successful extraction, not status alone. Hard platform termination cannot run JavaScript cleanup. Large/slow ZIPs still must finish within Vercel's actual limit. No durable background delivery worker was introduced.

## 7. Tests and evidence

- `npm run test:hardening`: PASS, 9 tests. Local tests cover generic reset responses on unknown/throttled/SMTP failures, SHA-256 and TTL, simulated concurrent/repeated claims and transactional rollback, shared-counter decisions and fail-closed behavior, SMTP transport options, both session durations/revocation, and real Archiver ZIP success/cancellation/source/finalize errors. Logging tests reject sensitive error fields.
- Database transactions/rate SQL and SMTP are mocked in the unit tests: this does **not** establish real PostgreSQL locking, applied migrations or real email delivery. Validate those in isolated staging.
- `npx prisma validate`: passed. `npx prisma migrate deploy --help`: verified, no DB mutation.
- `npm run build`: passed after implementation, including Prisma 7.9.1 generation and TypeScript. No Next.js/React/Auth.js/Prisma versions were upgraded.
- `npm run smoke:production`: PASS against the existing deployment (homepage/providers/session/CSRF 200; six protected APIs 401). Public-only GET checker, no credentials/body logging. This script checks the deployed version, not undeployed local fixes.
- Earlier live baseline: homepage/providers/session/CSRF 200, proper production HTTPS auth callback, HttpOnly/Secure/SameSite=Lax auth cookies, and projects/assets/notifications/settings/tasks/creators returned 401 without auth.
- Dependency install reported 11 advisories (10 high, 1 critical). No broad audit fix or major upgrade was run; dependency remediation needs a separately reviewed pass. Nodemailer and its development TypeScript declarations were the only additions.

Source-side logging was audited and sanitized; historical Vercel/provider logs were not fetched, scrubbed or rotated. Previously emitted reset URLs expire under the existing TTL. If the old seed password was used, rotate that account credential through an intentional operator action; no real credential was changed here.

## 8. Isolated authenticated manual test matrix

Create dedicated test accounts/data in a separate workspace, including assigned and unassigned content plus an unrelated workspace. Do not use existing real projects or the old seed credentials. For each role test API denials as well as hidden UI controls; a hidden button alone is not authorization.

| Flow | Admin / Manager | Editor | Creator |
| --- | --- | --- | --- |
| Login/logout/reload | Correct login; reload retains session; logout removes access | Same | Same |
| Remember checkbox | Unchecked defaults to ~8h; checked ~30d; test expiry | Same | Same |
| Password reset/settings password | Email, expiry, reuse/concurrent reuse denial; old sessions rejected | Same | Same |
| Project visibility | Own workspace only | Assigned content/creator access only | Own creator's content only |
| Project editing | Existing management actions within workspace | Only currently permitted assigned-project actions | Only current own-project actions; deny others |
| Tasks | Create/edit/delete and valid assignments | Allowed status updates; reject detail changes/create/delete | Own-project task controls only |
| Assets/versions | Authorized upload/version/delete/download | Assigned-project permissions only | Own-project permissions only |
| Review comments | Existing comment edit/delete/resolve rules | Assigned access; own-comment rules; reject review decisions | Own content and own-comment rules |
| Review decisions | Allowed on authorized reviews | Rejected | Allowed only as owning creator |
| Assignments | Manage own-workspace project/creator assignments | Reject assignment management | Reject assignment management |
| Settings | Own profile/password; workspace rename allowed | Own profile/password; deny workspace rename | Own profile/password; deny unrelated workspace controls |
| Notifications | Own list/read-state only | Own list/read-state only | Own list/read-state only |

Also verify: rate limits persist across concurrent requests/instances and expire; missing SMTP/database fails safely; known/unknown reset responses match; no debug reset data in Preview/Production; correct role isolation for direct asset/version IDs; download approved cut + all supporting files and inspect audit transferStatus=initiated. Test small and representative large ZIPs, slow client, cancellation, missing R2 object, and audit failure. Browser tests must cover desktop/mobile checkbox visibility and keyboard operation.

## 9. Release sequence / unresolved external work

1. Review changes; configure isolated staging env and apply the additive migration there.
2. Exercise the real DB race/rate tests, SMTP delivery, R2 browser flows and role matrix.
3. Configure Production environment/SMTP and apply Cloudflare CORS externally.
4. Apply pending migrations through the controlled production migration process before app rollout.
5. Deploy through the usual workflow (not performed here), run public smoke checks, then isolated production-account checks.
6. Verify Vercel duration/plan and large delivery behavior. Resolve dependency advisories in a separate scoped change.

External configuration, plan-specific duration choice, real email delivery, live DB migration/locking and authenticated production browser verification cannot be claimed completed without modifying external systems or using isolated test credentials. No such changes/tests were silently performed.

## 10. Files changed

Core: src/auth.ts; src/types/next-auth.d.ts; src/app/page.tsx; src/app/api/auth/password-reset/{request,confirm}/route.ts; src/app/api/settings/route.ts; src/app/api/projects/[projectId]/delivery/route.ts.

New helpers: src/lib/password-reset-email.ts; src/lib/rate-limit.ts; src/lib/delivery-zip.ts; src/lib/server-log.ts.

Logging/error boundaries: route.ts files under activity, assets (including upload-url, [assetId], download), creators (including assignments), notifications, organizations, projects (including assignments), reviews (comments/decision), signup and tasks (including [taskId]). Permission predicates were preserved.

Schema/operator/test: prisma/schema.prisma; prisma/migrations/20260929120000_auth_hardening/migration.sql; scripts/create-admin.ts; scripts/set-account-types.ts and scripts/link-futives-project.ts (logging only); scripts/production-smoke.mjs; tests/hardening.test.cjs.

Config/docs: .gitignore; .env.example; package.json; package-lock.json; README.md; PRODUCTION_READINESS.md; R2_CORS.json and R2_SETUP.txt (retained from readiness fixes).

DashboardClient.jsx and dashboard-target.css were not renamed or changed. No UI redesign, permission redesign or storage architecture change.
