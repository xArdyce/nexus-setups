const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

// Disposable in-memory fixtures only. The production precheck issues SELECTs only.
async function fixture() {
  const api = await import('../scripts/migration-precheck.mjs');
  const db = new PGlite();
  await db.exec(`CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUESTED');
    CREATE TABLE "AssetVersion" (id text PRIMARY KEY, "assetId" text NOT NULL, version integer NOT NULL, "storageKey" text NOT NULL);
    CREATE TABLE "Review" (id text PRIMARY KEY, "contentId" text NOT NULL, status "ReviewStatus" NOT NULL);
    CREATE TABLE "User" (id text PRIMARY KEY, "accountType" text);
    CREATE TABLE _prisma_migrations (id text, migration_name text, checksum text, started_at timestamp DEFAULT now(), finished_at timestamp, rolled_back_at timestamp);`);
  const migrations = api.localMigrations();
  for (const migration of migrations.filter(item => item.name !== api.TARGET)) {
    await db.query('INSERT INTO _prisma_migrations (id,migration_name,checksum,finished_at) VALUES ($1,$1,$2,now())', [migration.name, [...migration.checksums][0]]);
  }
  return { api, db, migrations };
}
async function inspect(f) {
  await f.db.exec('SET default_transaction_read_only = on');
  const queries = [];
  const report = await f.api.precheck({ query: (sql, values) => {
    assert.match(sql.trim(), /^SELECT\b/i);
    queries.push(sql);
    return f.db.query(sql, values);
  } }, f.migrations);
  assert.ok(queries.length > 5);
  return report;
}

test('clean pending migration passes; all production queries are SELECT and sample output excludes keys', async () => {
  const f = await fixture();
  try {
    const report = await inspect(f);
    assert.equal(f.api.exitCode(report), 0);
    assert.deepEqual(report.history.pending, [f.api.TARGET]);
    assert.ok(report.checks.every(check => check.status === 'ZERO_VIOLATIONS'));
  } finally { await f.db.close(); }
});

test('counts duplicate keys, pending review groups and nonpositive versions without revealing stored keys', async () => {
  const f = await fixture();
  try {
    await f.db.exec(`INSERT INTO "AssetVersion" VALUES ('v1','a1',0,'sensitive/storage/key'), ('v2','a2',-1,'sensitive/storage/key');
      INSERT INTO "Review" VALUES ('r1','c1','PENDING'), ('r2','c1','PENDING'), ('r3','c1','APPROVED');`);
    const report = await inspect(f);
    assert.equal(f.api.exitCode(report), 1);
    assert.deepEqual(report.checks.slice(0, 3).map(row => row.affected_records), ['2', '2', '2']);
    assert.equal(report.checks[0].violating_groups, '1');
    assert.equal(report.checks[1].violating_groups, '1');
    assert.equal(JSON.stringify(report).includes('sensitive/storage/key'), false);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM "AssetVersion"')).rows[0].n, 2);
  } finally { await f.db.close(); }
});

test('history mismatch, missing predecessors, unknown and unresolved attempts stop deployment', async () => {
  const f = await fixture();
  try {
    await f.db.exec(`UPDATE _prisma_migrations SET checksum = 'changed' WHERE migration_name = '20260818140349_init';
      DELETE FROM _prisma_migrations WHERE migration_name = '20260915190825_require_account_type';
      INSERT INTO _prisma_migrations (id,migration_name,checksum) VALUES ('bad','unknown-migration','changed');`);
    const report = await inspect(f);
    assert.equal(f.api.exitCode(report), 1);
    for (const term of ['Checksum mismatch', 'Other migrations', 'absent from', 'failed/incomplete'])
      assert.ok(report.blockers.some(item => item.includes(term)), term);
  } finally { await f.db.close(); }
});

test('target object without successful history stops; valid already-applied target passes', async () => {
  const f = await fixture();
  try {
    await f.db.exec(fs.readFileSync(`prisma/migrations/${f.api.TARGET}/migration.sql`, 'utf8'));
    const pending = await inspect(f);
    assert.equal(f.api.exitCode(pending), 1);
    assert.ok(pending.blockers.some(item => item.includes('Target objects exist')));
    await f.db.exec('SET default_transaction_read_only = off');
    await f.db.query('INSERT INTO _prisma_migrations (id,migration_name,checksum,finished_at) VALUES ($1,$1,$2,now())',
      [f.api.TARGET, [...f.migrations.at(-1).checksums][0]]);
    const applied = await inspect(f);
    assert.equal(f.api.exitCode(applied), 0);
    assert.equal(applied.history.targetState, 'already_applied');
    assert.ok(applied.targetObjects.every(row => row.expected));
  } finally { await f.db.close(); }
});

test('query failure is ERROR, never zero violations or leaked error text', async () => {
  const { precheck, exitCode } = await import('../scripts/migration-precheck.mjs');
  const report = await precheck({ query: async () => { throw Object.assign(new Error('password=secret'), { code: '42501' }); } });
  assert.equal(exitCode(report), 2);
  assert.equal(report.queryFailures[0].code, '42501');
  assert.equal(JSON.stringify(report).includes('secret'), false);
});

test('later query failure cannot appear as a zero-violation pass', async () => {
  const f = await fixture();
  try {
    await f.db.exec('DROP TABLE "AssetVersion"');
    const report = await inspect(f);
    assert.equal(f.api.exitCode(report), 2);
    assert.ok(report.checks.some(check => check.status === 'QUERY_FAILED'));
    assert.ok(report.queryFailures.some(failure => failure.code === '42P01'));
  } finally { await f.db.close(); }
});

test('recorded applied migration with a missing index is schema drift', async () => {
  const f = await fixture();
  try {
    await f.db.exec(fs.readFileSync(`prisma/migrations/${f.api.TARGET}/migration.sql`, 'utf8'));
    await f.db.query('INSERT INTO _prisma_migrations (id,migration_name,checksum,finished_at) VALUES ($1,$1,$2,now())',
      [f.api.TARGET, [...f.migrations.at(-1).checksums][0]]);
    await f.db.exec('DROP INDEX "Review_one_pending_per_content"');
    const report = await inspect(f);
    assert.equal(f.api.exitCode(report), 1);
    assert.ok(report.blockers.some(item => item.includes('schema drift')));
  } finally { await f.db.close(); }
});

test('inactive read-only guard stops before any table reads', async () => {
  const { precheck, exitCode } = await import('../scripts/migration-precheck.mjs');
  let calls = 0;
  const report = await precheck({ query: async () => { calls++; return { rows: [{ read_only: 'off' }] }; } });
  assert.equal(calls, 1);
  assert.equal(exitCode(report), 1);
});

test('Neon pooled configuration uses only the matching direct endpoint and preserves verified TLS/read-only startup', async () => {
  const { connectionConfig } = await import('../scripts/migration-precheck.mjs');
  const pg = require('pg');
  const { config, connectionMode } = connectionConfig('postgresql://fixture:synthetic@ep-fixture-pooler.c-1.eu-central-1.aws.neon.tech/example?sslmode=verify-full&channel_binding=require&options=untrusted');
  const url = new URL(config.connectionString);
  assert.equal(connectionMode, 'neon_direct_for_read_only_startup');
  assert.equal(url.hostname, 'ep-fixture.c-1.eu-central-1.aws.neon.tech');
  assert.equal(url.username, 'fixture');
  assert.equal(url.password, 'synthetic');
  assert.equal(url.pathname, '/example');
  assert.equal(url.searchParams.get('sslmode'), 'verify-full');
  assert.equal(url.searchParams.get('channel_binding'), 'require');
  const client = new pg.Client(config); // Inspect parsing only; never connect.
  assert.match(client.connectionParameters.options, /default_transaction_read_only=on/);
  assert.match(client.connectionParameters.options, /statement_timeout=60000/);
  assert.match(client.connectionParameters.options, /lock_timeout=5000/);
  assert.doesNotMatch(client.connectionParameters.options, /untrusted/);
  assert.notEqual(client.connectionParameters.ssl, false);
  assert.notEqual(client.connectionParameters.ssl.rejectUnauthorized, false);
});

test('direct and non-Neon connection hosts are not rewritten; SELECTs are simple protocol', async () => {
  const { connectionConfig } = await import('../scripts/migration-precheck.mjs');
  const Query = require('pg/lib/query');
  for (const host of ['ep-fixture.c-1.aws.neon.tech', 'fixture-pooler.example.invalid']) {
    const { config, connectionMode } = connectionConfig(`postgresql://fixture:synthetic@${host}/example`);
    assert.equal(new URL(config.connectionString).hostname, host);
    assert.equal(connectionMode, 'supplied_endpoint');
  }
  assert.equal(new Query('SELECT 1', []).requiresPreparation(), false);
});

test('08P01 during startup is labelled safely, executes no SQL, and never retries writable', async () => {
  const { runPrecheck } = await import('../scripts/migration-precheck.mjs');
  let queries = 0, connections = 0, closed = false;
  class Client {
    on() {}
    async connect() { connections++; throw Object.assign(new Error('hostname=private password=synthetic'), { code: '08P01' }); }
    async query() { queries++; }
    async end() { closed = true; }
  }
  const messages = [];
  const code = await runPrecheck('postgresql://fixture:synthetic@ep-fixture-pooler.c-1.aws.neon.tech/example', {
    Client, output: text => messages.push(text), errorOutput: text => messages.push(text),
  });
  assert.equal(code, 2);
  assert.equal(connections, 1);
  assert.equal(queries, 0);
  assert.equal(closed, true);
  assert.match(messages.join('\n'), /stage=connection_startup code=08P01/);
  assert.doesNotMatch(messages.join('\n'), /synthetic|ep-fixture|hostname=|postgresql:/);
});
