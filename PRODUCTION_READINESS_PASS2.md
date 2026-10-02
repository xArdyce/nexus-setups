# Nexus Setups Production Readiness — Pass 2

Audit date: 2 October 2026. Scope: the current working tree, including uncommitted Pass 1 changes. No production database, bucket, deployment or infrastructure was accessed. No commit/push/deployment was performed.

## A. Database/Prisma

**Correct existing controls:** foreign keys, cascading ContentItem cleanup, unique membership/assignment pairs, unique Creator user linkage, unique Asset current keys, and unique `(assetId, version)` pairs. Sequential version allocation uses the ContentItem row lock introduced in Pass 1. Review decisions and comments share that lock. Reset creation/consumption share a User row lock.

**Confirmed defects fixed:** registration uniqueness was checked only before acquiring the lock; simultaneous requests could register one object as multiple versions. Registration now rechecks under the lock, rejects a deleted parent, and returns conflicts. Creator/default-project creation is now atomic. Creator edits recheck lifecycle status under lock. Credential updates are conditional on the verified password, preventing a stale request from overwriting a concurrent reset.

**Database hardening:** the new `20261002090000_storage_review_integrity` migration enforces unique AssetVersion storage keys, one PENDING Review per ContentItem, and positive version numbers. The pending index is represented using Prisma's `partialIndexes` preview feature. The CHECK constraint is maintained in migration SQL because Prisma does not represent it in the schema.

All migrations replay successfully into an isolated in-memory PostgreSQL engine. Their columns, defaults, enums, foreign keys and indexes match SQL generated from the current Prisma schema. Constraint and cascade tests pass. This establishes repository consistency; it does not establish the state of the live database or multi-connection production lock behavior.

`prisma migrate deploy` is sufficient to apply the checked-in schema changes **when existing data satisfies migration preconditions and migration history is valid**. It does not generate the client, seed the organization used by signup, inspect drift, reconcile duplicate history, or configure R2. The build generates the Prisma client. Older migrations require non-null account types and no SCHEDULED/PUBLISHED rows, and drop the old ProjectAssignment table. Do not edit already-applied migrations or use `db push` to bypass failures.

**Optional improvements:** composite list/sort indexes and an activity JSON metadata index should follow representative EXPLAIN plans. Existing relation indexes are present. Assignment role/organization consistency is checked in API code; the database's assignment foreign keys and uniqueness alone do not enforce role membership across relation chains. Empty reusable Project containers can remain after ContentItem deletion; these are not dangling foreign keys.

## B. R2/storage

Presigned PUT URLs are scoped to authorized content and, for version uploads, an asset in that content. Pass 1's signed `If-None-Match: *` and Content-Type protections remain intact; an offline SDK test confirms the conditional header is signed. Cloudflare documents conditional PUT support: https://developers.cloudflare.com/r2/api/s3/api/.

Registration now rejects nested/path/control-character storage-key manipulation, enforces actual HEAD ContentLength of 1 byte through 5 GiB, requires valid stored MIME metadata, validates video/image/audio MIME families, and rejects a declared-size mismatch. Client metadata is no longer a fallback when HEAD metadata is missing. MIME validation checks metadata, not file signatures or malware.

Private current/historical downloads and ZIP delivery retain server-side authorization. Signed downloads expire after five minutes; already-issued URLs remain bearer capabilities until expiry. ZIP streaming opens one source at a time, maintains backpressure, and cancels/destroys active sources on abort or failure. Existing tests cover streaming, cancellation and provider failures.

Deletion still checks all current/historical keys, batches at 1,000 objects, and stops DB deletion on R2 errors. Explicit 60-second deletion transaction timeouts replace Prisma's five-second default, which was too short for network cleanup. This is bounded handling, not atomicity between systems.

**Confirmed operational limitation requiring manual recovery:** R2 deletions cannot roll back when a later batch or DB commit fails. Rejected uploads, registration failures and expired uploads can leave unregistered objects. There is no durable reconciliation worker. Do not automatically delete an object on an arbitrary registration error: another request may have registered it. Reconcile DB current/version references against objects, quarantine candidates, and retry failed deletion safely. A durable cleanup queue is an optional architectural follow-up, excluded from this pass.

**CORS required:** allow exact approved app origins, PUT/GET/HEAD, and `If-None-Match` plus `Content-Type`. SDK checksum headers may also appear. The checked-in `R2_CORS.json` already permits all request headers (`AllowedHeaders: ["*"]`), so it permits these headers if installed. Keep the bucket private; add Preview origins explicitly. Repository edits do not change Cloudflare configuration.

## C. Authentication/session security

Correct existing behavior retained: bcrypt cost 12; 256-bit random reset tokens; only SHA-256 token hashes stored; 30-minute expiry; transactional single-use consumption; generic reset-request responses; sessionVersion revocation; absolute eight-hour temporary and 30-day Remember Me lifetimes; fresh membership lookup in authorization routes; safe error logging; and PostgreSQL atomic rate-limit counters.

**Confirmed defects fixed:** password/email changes now invalidate outstanding reset links and revoke sessions atomically. Password changes recheck the verified hash under lock. Signup, reset and password-setting reject passwords beyond bcrypt's 72 UTF-8-byte limit; login rejects over-limit credentials. Existing accounts that historically used longer passwords may need a reset to a supported password. Signup and authenticated credential verification now use the existing PostgreSQL-backed limiter.

Production reset requests now fail closed when AUTH_URL/NEXTAUTH_URL is missing, insecure, or contains URL credentials, preventing request-origin fallback from determining reset destinations. Reset creation also rechecks the email under the User lock, preventing a concurrent email change from sending a fresh reset link to the previous address. Generic responses are preserved. SMTP sender implementation was not changed.

Auth.js defaults provide HttpOnly, SameSite=Lax cookies and Secure cookie names/settings on HTTPS. `trustHost: true` assumes the intended trusted Vercel/HTTPS ingress. Verify actual production cookies and trusted forwarded-IP handling; they were not observed live. The non-Vercel limiter deliberately does not trust arbitrary client IP headers, so its per-IP layer is not active outside the documented Vercel environment.

## D. API security

Authentication and target authorization remain in the resource mutation endpoints; IDs do not replace scope checks. Public signup/reset endpoints are intentionally unauthenticated. Mutable fields are constructed explicitly rather than spreading bodies into Prisma. Assignment writes require management membership in the target organization. Creator-user linkage now requires CREATOR membership in that organization.

Confirmed validation defects fixed: invalid task dates return 400 before Prisma; arbitrary asset filename searches no longer pass invalid strings to the AssetType enum. R2 registration and password bounds are covered above.

Storage redirects are generated by the configured R2 signer rather than a client URL. No server secret pattern was found in inspected source/client code; `.env` is untracked/ignored and no NEXT_PUBLIC secret keys were found. This is a current-tree inspection, not a historical secret audit. Error responses remain generic; logs use a code allowlist. No SMTP credential/token values were printed.

## E. Production configuration

Runtime requires DATABASE_URL, AUTH_SECRET (or legacy NEXTAUTH_SECRET), canonical HTTPS AUTH_URL (or legacy NEXTAUTH_URL), R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and all six SMTP fields for reset email delivery. VERCEL/NODE_ENV are platform managed. Keep runtime PostgreSQL connections pooled with TLS; use the appropriate controlled migration connection.

This checkout's local environment does not contain AUTH_URL or SMTP fields; development debug behavior is permitted, but this does not establish live Vercel configuration. Signup additionally expects the existing hardcoded Nexus organization record; migration deployment does not create that record. No seed/operator script was run.

Node runtime is compatible with Prisma, the AWS SDK and streaming ZIP code. The delivery route explicitly selects Node. Function duration, memory, large ZIP delivery and transaction timing need verification under the actual Vercel plan.

**Optional hardening:** application-level CSP/frame/referrer headers are not configured in next.config.ts. Actual CDN HTTPS/HSTS headers were not checked. Set a deliberate policy after testing the current app; no unverified CSP was imposed in this pass.

## F. Dependency findings

Initial audit: 12 flagged packages, 11 high and one critical. Targeted upgrade: Next.js 16.3.1 -> 16.3.8 and matching eslint-config-next. Afterward: 10 high, zero critical; Next/sharp findings are gone.

Next's Windows-host RCE is relevant to Windows self-hosting (this checkout runs on Windows), not the assumed Linux Vercel runtime: https://github.com/advisories/GHSA-p293-qw3h-jr36. The AVIF image-optimizer advisory concerns native sharp/libheif: https://github.com/advisories/GHSA-2xp9-vwfh-vxw4. No next/og ImageResponse route was found, so that advisory had no demonstrated application path: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j. The targeted patch removes all three version findings.

Remaining development/lint paths: brace-expansion and js-yaml through ESLint. Remaining CLI/transitive paths: fast-uri through Prisma local-development tooling, deepmerge-ts through Prisma configuration, and mysql2 shipped with the Prisma CLI. This application uses PostgreSQL, not MySQL, and does not accept client-controlled CLI configuration. Prisma is currently classified as a production dependency although these identified vulnerable paths are tooling paths.

Nodemailer warnings propagate to @auth/core and next-auth; they are not three independent application exploits. Current SMTP uses a fixed message, structured recipient, fixed operator transport, TLS, and disabled file/URL access. No reachable raw-message/legacy resolveContent/domain-allowlist/multi-tenant transport exploit was established. A major Nodemailer upgrade needs separate compatibility validation; SMTP behavior remains unchanged. Do not apply audit's suggested NextAuth/Prisma major-version downgrades or `audit fix --force`.

Added PGlite as a development-only test dependency to execute migrations/constraints without a server or production credentials. A Windows npm cleanup warning concerned an old locked SWC DLL directory; install and subsequent build succeeded. No process was stopped to force cleanup.

## G. Confirmed issues fixed

| Severity | Files | Problem and fix |
| --- | --- | --- |
| High, conditional applicability | package.json / package-lock.json | Vulnerable Next.js version; applied targeted security patch and matching lint config. |
| High, configuration-dependent | reset request route | Request-origin fallback could determine production reset destination; require configured canonical HTTPS origin and recheck current email under lock before issuing a token. |
| Medium | settings route | Outstanding reset links survived credential changes and stale password requests could overwrite resets; atomic lock/conditional mutation/token invalidation/session revocation. |
| Medium | auth, signup, reset confirm, settings | bcrypt truncation above 72 bytes; reject unsupported passwords/credentials. |
| Medium | assets route/schema/new migration | Pre-lock duplicate registration and absent object uniqueness; locked recheck plus DB uniqueness. |
| Medium | assets/upload-url routes | Actual size/MIME and storage-key validation gaps; enforce trusted metadata, bounds and scope. |
| Medium | rate-limit, signup, settings | Unbounded expensive signup/credential verification attempts; use shared PostgreSQL limiter. |
| Medium | creators route | Partial creator/project creation and foreign-organization user linkage; transaction and target membership check. |
| Medium | project detail route | Lifecycle check could become stale before detail mutation; lock and status recheck. |
| Medium | asset/project deletion routes | Default five-second transaction could expire during R2 cleanup; explicit bounded 60-second timeout. Cross-system recovery still requires manual handling. |
| Low | task routes/assets route | Invalid dates and arbitrary search enums became 500 errors; validation and conditional enum filter. |

One-pending-review and positive-version constraints are explicitly **database hardening**, rather than a claim that the locked Pass 1 routes still created duplicate pending reviews. Performance indexes, security headers, durable cleanup, binary MIME inspection and email verification are optional follow-ups.

## H. Tests/build results

51 tests pass: 24 workflow, 11 hardening, 14 new backend security and two offline PostgreSQL migration tests. The workflow file is unchanged. All hardening assertions remain; two fixtures supply the canonical production AUTH_URL and current-email transaction lookup required by the fixes. Tests never use production database/R2 credentials. Prisma validation and the Next.js 16.3.8 production build pass. `git diff --check` passes; Pass 2 changes were compared to a separate starting snapshot.

Commands: `npm run test:workflow`, `npm run test:hardening`, `npm run test:backend`, `npm run build`, `git diff --check`. The build used an unreachable local dummy DATABASE_URL.

## I. Required manual production/infrastructure actions

1. Before applying the new migration, check duplicate AssetVersion storage keys, multiple PENDING reviews per content, and nonpositive version numbers. Reconcile deliberately; do not delete historical records blindly. Verify older migration preconditions/history and run migrate deploy only from the controlled release environment. No production checks were performed here.
2. Verify canonical HTTPS AUTH_URL, secret configuration, pooled TLS DB connection, existing signup organization, trusted ingress/IP header, and Secure/HttpOnly/SameSite cookies. Password/email changes now require signing in again.
3. Verify private R2 access and install/confirm CORS permitting `If-None-Match` and Content-Type. Test a first PUT, replay/missing-condition rejection, registration, historical access and ZIP downloads using an isolated account/bucket.
4. Test real multi-connection concurrency, deletion timeouts, partial R2 failures, DB rollback/commit failure, function limits and ZIP cancellation under a controlled environment. Offline tests do not establish production performance.
5. Establish a reconciliation procedure for unregistered uploads and partially deleted objects, and review the remaining tooling/SMTP advisories with the documented reachability distinction.

## J. Files changed by Pass 2

- package.json; package-lock.json
- prisma/schema.prisma; prisma/migrations/20261002090000_storage_review_integrity/migration.sql
- src/auth.ts; src/lib/rate-limit.ts
- src/app/api/assets/route.ts; src/app/api/assets/upload-url/route.ts; src/app/api/assets/[assetId]/route.ts
- src/app/api/creators/route.ts; src/app/api/projects/[projectId]/route.ts
- src/app/api/settings/route.ts; src/app/api/signup/route.ts
- src/app/api/tasks/route.ts; src/app/api/tasks/[taskId]/route.ts
- src/app/api/auth/password-reset/request/route.ts; src/app/api/auth/password-reset/confirm/route.ts
- tests/hardening.test.cjs (two fixture updates; assertions unchanged)
- tests/backend-security.test.cjs; tests/migrations.test.cjs
- PRODUCTION_READINESS_PASS2.md

Pass 1 changes and all other pre-existing changes were preserved. No UI, SMTP sender, existing migration, Cloudflare configuration or Vercel infrastructure changes were made.
