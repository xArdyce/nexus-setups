import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const TARGET = '20261002090000_storage_review_integrity';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const safeId = value => /^[A-Za-z0-9_-]{1,100}$/.test(String(value)) ? String(value) : '[redacted nonstandard ID]';
const codeOnly = error => /^[A-Z0-9_]{2,40}$/.test(error?.code ?? '') ? error.code : 'QUERY_FAILED';

export function localMigrations() {
  const directory = join(root, 'prisma', 'migrations');
  return readdirSync(directory, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => {
    const sql = readFileSync(join(directory, item.name, 'migration.sql'), 'utf8');
    // Accept conventional checkout line-ending differences, not SQL edits.
    const lf = sql.replace(/\r\n/g, '\n');
    const checksums = new Set([sql, lf, lf.replace(/\n/g, '\r\n')].map(text => createHash('sha256').update(text).digest('hex')));
    return { name: item.name, checksums };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function precheck(client, migrations = localMigrations()) {
  const report = { target: TARGET, checks: [], blockers: [], queryFailures: [], history: null };
  async function query(label, sql, values = []) {
    if (!/^SELECT\b/i.test(sql.trim())) throw new Error('Only SELECT is permitted');
    try { return (await client.query(sql, values)).rows; }
    catch (error) { report.queryFailures.push({ check: label, code: codeOnly(error) }); return null; }
  }
  const settings = await query('read_only_guard', `SELECT current_setting('default_transaction_read_only') AS read_only,
    current_setting('transaction_read_only') AS transaction_read_only,
    current_setting('search_path') AS search_path`);
  if (!settings || settings[0]?.read_only !== 'on' || settings[0]?.transaction_read_only !== 'on') {
    report.blockers.push('Read-only connection guard not active; no data checks performed.');
    return report;
  }
  const history = await query('migration_history', `SELECT migration_name, checksum,
    finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
    FROM public._prisma_migrations ORDER BY started_at, id`);
  if (history) {
    const known = new Map(migrations.map(item => [item.name, item]));
    const applied = new Set();
    for (const row of history) {
      const name = known.has(row.migration_name) ? row.migration_name : '[unknown migration]';
      if (!known.has(row.migration_name)) report.blockers.push('Database history contains a migration absent from this checkout.');
      else if (!known.get(row.migration_name).checksums.has(row.checksum)) report.blockers.push(`Checksum mismatch: ${name}.`);
      if (!row.finished && !row.rolled_back) report.blockers.push(`Unresolved failed/incomplete migration: ${name}.`);
      if (row.finished && !row.rolled_back) {
        if (applied.has(row.migration_name)) report.blockers.push(`Multiple successful history entries: ${name}.`);
        applied.add(row.migration_name);
      }
    }
    const pending = migrations.filter(item => !applied.has(item.name)).map(item => item.name);
    const predecessors = pending.filter(name => name !== TARGET);
    if (predecessors.length) report.blockers.push('Other migrations are pending; this precheck does not approve their deployment.');
    if (!known.has(TARGET) || migrations.at(-1)?.name !== TARGET) report.blockers.push('Target is missing or no longer the latest local migration; re-audit this precheck.');
    report.history = { successful: migrations.filter(item => applied.has(item.name)).map(item => item.name), pending,
      targetState: applied.has(TARGET) ? 'already_applied' : 'pending', rolledBackAttempts: history.filter(row => row.rolled_back).length };
  }

  const prerequisite = await query('target_schema_prerequisites', `SELECT c.relname AS table_name, c.relkind::text AS kind,
    a.attname AS column_name, a.attnotnull AS required, format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
      AND ((c.relname = 'AssetVersion' AND a.attname IN ('id', 'assetId', 'version', 'storageKey'))
        OR (c.relname = 'Review' AND a.attname IN ('id', 'contentId', 'status')))`);
  if (prerequisite) {
    const expected = new Map([
      ['AssetVersion.id', 'text'], ['AssetVersion.assetId', 'text'], ['AssetVersion.version', 'integer'],
      ['AssetVersion.storageKey', 'text'], ['Review.id', 'text'], ['Review.contentId', 'text'], ['Review.status', '"ReviewStatus"'],
    ]);
    if (prerequisite.length !== expected.size || prerequisite.some(row => row.kind !== 'r' || !row.required ||
      expected.get(`${row.table_name}.${row.column_name}`) !== row.type))
      report.blockers.push('Target tables/columns differ from expected prior schema (type, nullability, or table kind).');
  }
  const olderChecks = [
    ['20260915190825_require_account_type', 'older_null_account_types', `SELECT count(*)::text AS affected_records FROM public."User" WHERE "accountType" IS NULL`],
    ['20260925102200_remove_scheduled_published_statuses', 'older_obsolete_content_statuses', `SELECT count(*)::text AS affected_records FROM public."ContentItem" WHERE "status"::text IN ('SCHEDULED', 'PUBLISHED')`],
    ['20260925112110_add_review_comment_management', 'older_review_comments_without_updated_at_default', `SELECT count(*)::text AS affected_records FROM public."ReviewComment"`],
  ];
  for (const [migration, name, sql] of olderChecks) {
    if (!report.history?.pending.includes(migration)) continue;
    const rows = await query(name, sql);
    report.checks.push(rows ? { name, status: BigInt(rows[0].affected_records) > 0n ? 'VIOLATIONS' : 'ZERO_VIOLATIONS', ...rows[0] }
      : { name, status: 'QUERY_FAILED' });
    if (rows && BigInt(rows[0].affected_records) > 0n) report.blockers.push(`Older migration data blocker: ${migration}.`);
  }
  if (report.history?.pending.includes('20260918052815_remove_old_project_assignments')) {
    const exists = await query('older_project_assignment_table', `SELECT to_regclass('public."ProjectAssignment"') IS NOT NULL AS present`);
    if (exists?.[0]?.present) {
      const rows = await query('older_project_assignment_data_loss', `SELECT count(*)::text AS affected_records FROM public."ProjectAssignment"`);
      report.checks.push(rows ? { name: 'older_project_assignment_data_loss', status: BigInt(rows[0].affected_records) > 0n ? 'REQUIRES_REVIEW' : 'ZERO_VIOLATIONS', ...rows[0] }
        : { name: 'older_project_assignment_data_loss', status: 'QUERY_FAILED' });
      if (rows && BigInt(rows[0].affected_records) > 0n) report.blockers.push('Older migration would discard ProjectAssignment rows.');
    }
  }

  const checks = [
    ['duplicate_version_storage_keys', `SELECT count(*)::text AS violating_groups,
      COALESCE(sum(n), 0)::text AS affected_records FROM
      (SELECT count(*) AS n FROM public."AssetVersion" WHERE "storageKey" IS NOT NULL GROUP BY "storageKey" HAVING count(*) > 1) d`,
      `SELECT "id", "assetId" FROM (SELECT "id", "assetId", count(*) OVER (PARTITION BY "storageKey") AS n
       FROM public."AssetVersion" WHERE "storageKey" IS NOT NULL) d WHERE n > 1 ORDER BY "id" LIMIT 20`],
    ['multiple_pending_reviews', `SELECT count(*)::text AS violating_groups,
      COALESCE(sum(n), 0)::text AS affected_records FROM
      (SELECT count(*) AS n FROM public."Review" WHERE "status" = 'PENDING' AND "contentId" IS NOT NULL
       GROUP BY "contentId" HAVING count(*) > 1) d`,
      `SELECT "id", "contentId" FROM (SELECT "id", "contentId", count(*) OVER (PARTITION BY "contentId") AS n
       FROM public."Review" WHERE "status" = 'PENDING' AND "contentId" IS NOT NULL) d WHERE n > 1 ORDER BY "id" LIMIT 20`],
    ['nonpositive_versions', `SELECT count(*)::text AS affected_records FROM public."AssetVersion" WHERE "version" <= 0`,
      `SELECT "id", "assetId" FROM public."AssetVersion" WHERE "version" <= 0 ORDER BY "id" LIMIT 20`],
    // NULLs do not violate these new SQL constraints, but violate the expected prior schema.
    ['required_column_nulls', `SELECT
      ((SELECT count(*) FROM public."AssetVersion" WHERE "version" IS NULL OR "storageKey" IS NULL) +
       (SELECT count(*) FROM public."Review" WHERE "contentId" IS NULL OR "status" IS NULL))::text AS affected_records`, null],
  ];
  for (const [name, sql, sampleSql] of checks) {
    const rows = await query(name, sql);
    if (!rows) { report.checks.push({ name, status: 'QUERY_FAILED' }); continue; }
    const counts = rows[0];
    const violation = BigInt(counts.affected_records) > 0n;
    const result = { name, status: violation ? 'VIOLATIONS' : 'ZERO_VIOLATIONS', ...counts };
    if (violation) {
      report.blockers.push(`Existing-data violations: ${name}.`);
      if (sampleSql) {
        const samples = await query(`${name}_samples`, sampleSql);
        if (samples) result.sampleIds = samples.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeId(value)])));
      }
    }
    report.checks.push(result);
  }
  const objects = await query('target_objects', `SELECT c.relname AS name, c.relkind::text AS kind,
    CASE WHEN i.indexrelid IS NOT NULL THEN i.indisunique AND i.indisvalid AND i.indisready
      AND i.indnkeyatts = 1 AND i.indnatts = 1 AND i.indexprs IS NULL
      AND a.attname = CASE c.relname WHEN 'AssetVersion_storageKey_key' THEN 'storageKey' ELSE 'contentId' END
      AND t.relname = CASE c.relname WHEN 'AssetVersion_storageKey_key' THEN 'AssetVersion' ELSE 'Review' END
      AND tn.nspname = 'public'
      AND CASE c.relname WHEN 'AssetVersion_storageKey_key' THEN i.indpred IS NULL
        ELSE pg_get_expr(i.indpred, i.indrelid) = '(status = ''PENDING''::"ReviewStatus")' END
      ELSE false END AS expected
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_index i ON i.indexrelid = c.oid LEFT JOIN pg_class t ON t.oid = i.indrelid
    LEFT JOIN pg_namespace tn ON tn.oid = t.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND c.relname IN ('AssetVersion_storageKey_key', 'Review_one_pending_per_content')`);
  const constraint = await query('target_check_constraint', `SELECT k.conname AS name,
    k.contype = 'c' AND k.convalidated AND pg_get_expr(k.conbin, k.conrelid) = '(version > 0)' AS expected
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'AssetVersion' AND k.conname = 'AssetVersion_positive_version'`);
  if (objects && constraint && report.history) {
    if (report.history.targetState === 'pending' && (objects.length || constraint.length))
      report.blockers.push('Target objects exist without successful migration history; possible manual/partial application or name collision.');
    if (report.history.targetState === 'already_applied' && (objects.length !== 2 || constraint.length !== 1 ||
      [...objects, ...constraint].some(row => row.expected !== true)))
      report.blockers.push('Applied migration does not match expected valid target indexes/check; schema drift requires review.');
    report.targetObjects = [...objects, ...constraint].map(row => ({ name: row.name, expected: row.expected }));
  }
  report.blockers = [...new Set(report.blockers)];
  return report;
}

export function exitCode(report) { return report.queryFailures.length ? 2 : report.blockers.length ? 1 : 0; }

export function connectionConfig(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (url.searchParams.get('schema') ?? 'public') !== 'public')
    throw new Error('Unsupported connection configuration');
  let connectionMode = 'supplied_endpoint';
  // Neon transaction pooling rejects these untracked startup settings. Its matching
  // direct endpoint has the same database/role/TLS configuration and a stable session.
  // Never fall back to a writable pooled connection or session-changing SELECTs.
  const labels = url.hostname.split('.');
  if (url.hostname.endsWith('.neon.tech') && labels[0].endsWith('-pooler')) {
    labels[0] = labels[0].slice(0, -'-pooler'.length);
    url.hostname = labels.join('.');
    connectionMode = 'neon_direct_for_read_only_startup';
  }
  // Prevent connection-string options from overriding the read-only startup guard.
  url.searchParams.delete('options');
  url.searchParams.set('options', '-c default_transaction_read_only=on -c search_path=public -c statement_timeout=60000 -c lock_timeout=5000');
  return { connectionMode, config: { connectionString: url.toString(), connectionTimeoutMillis: 10000,
    application_name: 'nexus-readonly-migration-precheck' } };
}

export async function runPrecheck(connectionString, { Client = pg.Client, output = console.log, errorOutput = console.error } = {}) {
  if (!connectionString) {
    errorOutput('ERROR: stage=connection_configuration. Supply NEXUS_PRECHECK_DATABASE_URL securely in the environment. No connection attempted.');
    return 2;
  }
  let client;
  let stage = 'connection_configuration';
  try {
    const { config, connectionMode } = connectionConfig(connectionString);
    output(`stage=connection_configuration mode=${connectionMode}`);
    client = new Client(config);
    client.on('error', () => {}); // Never emit unsanitized provider messages/connection details.
    stage = 'connection_startup';
    await client.connect();
    stage = 'precheck';
    const report = await precheck(client);
    const code = exitCode(report);
    output(JSON.stringify({ result: code === 0 ? 'PASS' : code === 1 ? 'STOP' : 'ERROR', ...report }, null, 2));
    output('Point-in-time checks only; concurrent writes can change the result before migration. No writes or migrations performed.');
    return code;
  } catch (error) {
    errorOutput(`ERROR: stage=${stage} code=${codeOnly(error)}. Details suppressed to protect credentials/data. This is not zero violations.`);
    return 2;
  } finally { if (client) await client.end().catch(() => {}); }
}

// Deliberately never load .env or accept a URL argument (shell history/process list).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await runPrecheck(process.env.NEXUS_PRECHECK_DATABASE_URL);
