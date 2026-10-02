# Read-only Pass 2 migration precheck

Target: `20261002090000_storage_review_integrity`. Prepared from the current schema, all 13 migration files, and `PRODUCTION_READINESS_PASS2.md`. No production connection or migration was performed.

## Exact migration changes and blockers

The migration executes these three changes inside BEGIN/COMMIT:

1. Unique index `AssetVersion_storageKey_key` on `AssetVersion.storageKey`. Two historical AssetVersion rows with the same non-null key block creation, even across different assets. Sharing a key between one Asset and its own AssetVersion is expected and is not a violation of this index.
2. Partial unique index `Review_one_pending_per_content` on `Review.contentId` where status is PENDING. Two or more PENDING reviews for the same non-null content ID block creation. Multiple approved/revision-requested historical reviews are allowed.
3. Validated CHECK `AssetVersion_positive_version` requiring `version > 0`. Existing zero or negative version numbers block creation. Version gaps do not violate this check; `(assetId, version)` uniqueness was already enforced by the initial migration.

There are no other columns, foreign keys, data transformations, or indexes in this migration. The current Prisma schema represents the unique/partial indexes; the CHECK is maintained in migration SQL. NULL values are not rejected by these SQL rules themselves, but the preceding schema already requires these columns to be non-null; the precheck treats NULLs or incompatible column definitions as schema drift.

Existing objects using either index name, or the CHECK name on AssetVersion, can also make this non-idempotent migration fail. The precheck stops when such objects exist without a successful migration-history entry. If the migration is already recorded as applied, it checks that both indexes are unique/valid/ready with the expected columns/predicate and that the positive-version CHECK is validated and has the expected expression.

Other possible failures—migration-user permissions, insufficient storage, locks, connection interruption, or provider limitations—cannot be ruled out by clean data checks. No migration locks are acquired or DDL privileges exercised by this script.

## Running it

From `Database/nexus-setups`, provision the intended production PostgreSQL connection securely in the process environment as `NEXUS_PRECHECK_DATABASE_URL`, then run:

```powershell
node scripts/migration-precheck.mjs
$LASTEXITCODE
```

If the intended production URL is already securely provisioned as `DATABASE_URL` in this shell, copy it without printing it:

```powershell
$env:NEXUS_PRECHECK_DATABASE_URL = $env:DATABASE_URL
node scripts/migration-precheck.mjs
$LASTEXITCODE
Remove-Item Env:NEXUS_PRECHECK_DATABASE_URL
```

Do not paste a credential-bearing URL into a command argument or shell history. The script never loads `.env`, never defaults to the application's local database, and never prints the URL, credentials, raw database error messages, migration logs, storage keys, filenames, emails, titles, or review contents. Use the intended primary database endpoint, not a lagging read replica, and preserve your provider's required TLS configuration. A dedicated SELECT-only account is recommended; it needs access to the checked tables, migration history, and PostgreSQL catalogs.

When supplied a recognized Neon pooled endpoint, `migration-precheck.mjs` automatically converts it to the corresponding direct endpoint. Neon transaction pooling does not support the startup settings needed for this read-only session. The conversion preserves the database, role, credentials, and supplied TLS configuration; direct and non-Neon endpoints are unchanged. The script never falls back to a writable pooled connection.

The script explicitly targets `public`, matching repository migrations. URLs selecting another Prisma schema are rejected. Startup options enforce `default_transaction_read_only=on`, a 60-second statement timeout, and a five-second lock timeout. Read-only state is verified before table reads. Every SQL operation sent by the script is a SELECT; there is no INSERT, UPDATE, DELETE, DDL, migration, automatic repair, or transaction mutation. Timeouts or insufficient read permissions produce ERROR, not a clean result.

## Checks and output

- Duplicate historical storage-key groups and number of affected AssetVersions; up to 20 AssetVersion/asset IDs. Keys are never printed.
- Duplicate pending-review groups and number of affected reviews; up to 20 review/content IDs.
- Number of nonpositive versions; up to 20 AssetVersion/asset IDs.
- Unexpected NULLs in required version/key/content/status fields.
- Target table/column types, nullability, and ordinary-table prerequisites.
- Target index/CHECK name collisions or missing/incorrect target objects if already applied.
- `_prisma_migrations`: successful/pending local migration names, checksum compatibility with this checkout (including LF/CRLF checkout differences), unknown migrations, duplicate successful entries, unresolved failed/incomplete attempts, and count of rolled-back attempts. Logs and credentials are never selected. Rolled-back attempts alone do not prevent a clean retry when history and objects are otherwise consistent.
- When the relevant older migrations are pending: NULL account-type count, obsolete content-status count, ReviewComment row count (the older migration adds a required updatedAt column without a default), and existing ProjectAssignment row count before its destructive drop. Missing prerequisite tables/columns cause ERROR rather than a false clean count.

Record samples are bounded and nonstandard IDs are redacted. Counts cover all matching rows, not just samples. Queries are separate autocommit read-only snapshots; concurrent writes can change results during or after the run. A PASS does not eliminate the need for controlled migration timing and a fresh check near release.

## Safe result

Exit code **0**, `result: "PASS"`, empty `blockers` and `queryFailures`, and every data check marked `ZERO_VIOLATIONS`.

For a first application, `history.pending` must contain only `20261002090000_storage_review_integrity`, `targetState` must be `pending`, and no target objects should exist yet. All 12 predecessors must have compatible successful history. If it is already applied, PASS instead requires no pending migrations and verified expected target objects; deploy would not apply it again.

## Stop conditions

- Exit **1**, `result: "STOP"`: data violations, history/checksum problems, unexpected pending migrations, or target schema/object drift. Reconcile deliberately under a separately approved plan; do not discard historical versions/reviews blindly, edit already-applied migration files, or use db push/automatic repair to bypass this result.
- Exit **2**, `result: "ERROR"`: missing/invalid connection configuration, unavailable history/table, insufficient SELECT permission, connection failure, query timeout, or any other query failure. An ERROR is never evidence of zero violations. Fix the ability to perform the check and rerun.

Older pending migrations are explicitly blocked rather than automatically approved. Their known data conditions include non-null `User.accountType`, no SCHEDULED/PUBLISHED ContentItem statuses before the enum conversion, an empty ReviewComment table before its required updatedAt column is added without a default, and deliberate handling of existing ProjectAssignment rows before the old table is dropped. The script reports those conditions when relevant, but does not approve or exhaustively audit older pending migrations: stop and prepare a separate review if any are pending. A missing `_prisma_migrations` table is ERROR; it must not be treated as an empty safe history.

## Verification of the tool

`node --test tests/migration-precheck.test.cjs`: disposable in-memory PostgreSQL fixtures test clean data, violations, history failures, target partial/already-applied state, read-only guard, and query-error sanitization. Fixture setup writes only to the disposable in-memory engine; the production-script queries remain SELECT-only. The existing 51 tests remain unchanged. No dependency, Prisma schema, migration file, application behavior, or production infrastructure was changed.
