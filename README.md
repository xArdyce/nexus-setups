# Nexus Setups

Next.js application using Auth.js credentials, Prisma/PostgreSQL and private Cloudflare R2 storage.

## Local development

Copy `.env.example` to an ignored `.env` and replace placeholders. Use an isolated development database and bucket. Leave `SMTP_HOST` empty to use development-only reset debug links; otherwise use a test SMTP account with TLS. Never put credentials in `NEXT_PUBLIC_` variables.

```sh
npm ci
npx prisma migrate deploy
npm run dev
```

The migration command affects the database selected by `DATABASE_URL`: verify the target first. Open http://localhost:3000.

## Production release

1. In Vercel → Nexus Setups → Settings → Environment Variables, configure the scope-specific variables in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Set Production `AUTH_URL` to https://www.setups.nexus. Keep Preview data and SMTP separate.
2. Configure a provider-authorized SMTP sender with SPF/DKIM as required by that provider. Set all six `SMTP_*` fields. Use port 587 with `SMTP_SECURE=false` (required STARTTLS) or 465 with `true`. Validate receipt using an isolated account; generic reset success does not prove delivery.
3. Use a Neon pooled TLS connection for runtime `DATABASE_URL`. From your controlled migration environment with the intended database selected, run `npx prisma migrate deploy` **before deploying this code**. This release adds `RateLimit` and `User.sessionVersion`; missing migration causes auth to fail closed. No Studio, `db push` or reset is needed. `prisma.config.ts` uses the migration process's `DATABASE_URL`; supply a direct Neon connection there if required by your migration setup, without changing Vercel's pooled runtime value.
4. In Cloudflare → R2 Object Storage → select your bucket → Settings → CORS Policy → Edit/Add → JSON, paste [R2_CORS.json](R2_CORS.json), add intended Preview origins explicitly, and Save. Repository edits do not update Cloudflare.
5. Run `npm run test:hardening` and `npm run build`. The build includes `prisma generate`, not migration application. Deploy through your normal release process when ready.
6. Run `npm run smoke:production`, then complete the isolated role matrix in the report. This script only sends public GET requests. For another target: `npm run smoke:production -- https://YOUR-PREVIEW.vercel.app`.
7. Test a representative large delivery ZIP and cancellation, missing-object and audit-failure cases. Verify the project's Node runtime, Fluid Compute setting, plan duration ceiling and configured function duration in Vercel. Streaming still counts toward the limit; no unverified `maxDuration` value is set in this repository.

## Admin operator warning

Do not run `scripts/create-admin.ts` as part of deployment or normal tests. It requires `ADMIN_INITIAL_PASSWORD` (12 characters minimum, 72 UTF-8 bytes maximum) in the operator's environment and refuses to change an existing account unless `--update-existing-password` is explicitly supplied. That flag changes credentials and revokes previous sessions. It does not grant an organization role. Never place the initial password in a command-line argument, commit, build log, or persistent Vercel runtime environment. The script was not executed during hardening.

The latest release findings are in [PRODUCTION_READINESS_PASS4.md](PRODUCTION_READINESS_PASS4.md). Historical audit reports may contain superseded origin guidance. Production and Preview reset delivery require their explicit HTTPS AUTH_URL.

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for implementation details, test evidence, remaining external configuration and the manual role matrix.
