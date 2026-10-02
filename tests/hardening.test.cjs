const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');

function load(file, mocks = {}, env = {}, logger = { error() {}, log() {}, warn() {} }) {
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports, require: name => name in mocks ? mocks[name] : require(name),
    process: { env }, URL, Date, Buffer, Response, Request, AbortController,
    console: logger,
  }, { filename: file });
  return exports;
}
const responseMock = { NextResponse: { json: (body, init) => Response.json(body, init) } };
const quiet = { logServerError() {} };
const request = body => new Request('https://nexus-setups.vercel.app/api/test', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});

test('safe logger never serializes sensitive errors or arbitrary provider codes', () => {
  const captured = [];
  const { logServerError } = load('src/lib/server-log.ts', {}, {}, {
    error: (...args) => captured.push(args),
  });
  const error = Object.assign(new Error('private reset URL and password'), {
    code: 'untrusted@example.invalid', cause: { password: 'private' },
  });
  logServerError('SMTP delivery failed', error);
  logServerError('Database request failed', { code: 'P2002', meta: { token: 'private' } });
  assert.equal(JSON.stringify(captured), '[["SMTP delivery failed",{"code":"INTERNAL_ERROR"}],["Database request failed",{"code":"P2002"}]]');
});

test('reset request: generic responses, SMTP failure, hashing, TTL and development origin', async () => {
  async function run({ known = true, failure = false, mode = 'production', allowed = true, authUrl = 'https://nexus-setups.vercel.app' } = {}) {
    let saved, sent;
    const db = {
      user: { findUnique: async () => known ? { id: 'test', email: 'test@example.invalid' } : null },
      $queryRaw: async () => [],
      passwordResetToken: { deleteMany: async () => {}, create: async ({ data }) => { saved = data; } },
    };
    db.$transaction = fn => fn(db);
    const { POST } = load('src/app/api/auth/password-reset/request/route.ts', {
      'next/server': responseMock, '@/lib/prisma': { prisma: db },
      '@/lib/rate-limit': { allowAuthAttempt: async () => allowed },
      '@/lib/server-log': quiet,
      '@/lib/password-reset-email': { sendPasswordResetEmail: async (to, url) => {
        sent = { to, url }; if (failure) throw new Error('sensitive SMTP response');
      } },
    }, { NODE_ENV: mode, AUTH_URL: authUrl });
    const result = await POST(request({ email: 'TEST@example.invalid' }));
    return { result, body: await result.json(), saved, sent };
  }
  const success = await run();
  for (const variant of [{ known: false }, { failure: true }, { allowed: false }]) {
    const result = await run(variant);
    assert.equal(result.result.status, 200);
    assert.deepEqual(result.body, success.body);
    if (variant.known === false || variant.allowed === false) assert.equal(result.sent, undefined);
  }
  assert.equal(success.body.debugResetUrl, undefined);
  const raw = new URL(success.sent.url).searchParams.get('resetToken');
  assert.equal(success.saved.tokenHash, createHash('sha256').update(raw).digest('hex'));
  assert.ok(Math.abs(+success.saved.expiresAt - Date.now() - 1_800_000) < 3000);
  const dev = await run({ mode: 'development', authUrl: 'http://localhost:3000' });
  assert.equal(new URL(dev.body.debugResetUrl).origin, 'http://localhost:3000');
});

test('reset confirmation: concurrent/sequential reuse fails; transaction rolls back on password failure', async () => {
  async function scenario(failPassword = false) {
    let usedAt = null, updates = 0, queue = Promise.resolve();
    const token = { id: 't', userId: 'u', expiresAt: new Date(Date.now() + 60_000), usedAt: null };
    const db = {
      passwordResetToken: { findUnique: async () => ({ ...token, usedAt }) },
      $transaction(fn) {
        const run = queue.then(async () => {
          const before = usedAt;
          try { return await fn({
            $queryRaw: async () => [],
            passwordResetToken: {
              updateMany: async ({ where, data }) => {
                assert.equal(where.usedAt, null);
                assert.ok(where.expiresAt.gt instanceof Date);
                if (usedAt || token.expiresAt <= where.expiresAt.gt) return { count: 0 };
                usedAt = data.usedAt; return { count: 1 };
              }, deleteMany: async () => {},
            },
            user: { update: async ({ data }) => {
              assert.equal(data.sessionVersion.increment, 1);
              if (failPassword) throw Error('database failure');
              updates++;
            } },
          }); } catch (error) { usedAt = before; throw error; }
        });
        queue = run.catch(() => {}); return run;
      },
    };
    const { POST } = load('src/app/api/auth/password-reset/confirm/route.ts', {
      'next/server': responseMock, '@/lib/prisma': { prisma: db },
      '@/lib/rate-limit': { allowAuthAttempt: async () => true }, '@/lib/server-log': quiet,
      bcryptjs: { hash: async (_, rounds) => { assert.equal(rounds, 12); return 'hashed'; } },
    });
    const invoke = () => POST(request({ token: 'a'.repeat(64), password: 'test-password' }));
    if (failPassword) {
      assert.equal((await invoke()).status, 500); assert.equal(usedAt, null); assert.equal(updates, 0);
    } else {
      const results = await Promise.all([invoke(), invoke()]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
      assert.equal((await invoke()).status, 400); assert.equal(updates, 1);
    }
  }
  await scenario(); await scenario(true);
});

test('rate limiter: bounded shared counters, opaque identity and fail closed', async () => {
  const counters = new Map();
  const prisma = {
    $queryRaw: async (sql, key, seconds, again, limit) => {
      assert.match(sql.join(''), /ON CONFLICT/);
      assert.match(key, /^[a-f0-9]{64}$/);
      assert.equal(seconds, again);
      const count = counters.get(key) || 0;
      if (count >= limit) return [];
      counters.set(key, count + 1); return [{ count: count + 1 }];
    }, $executeRaw: async () => 0,
  };
  const { allowAuthAttempt } = load('src/lib/rate-limit.ts', { '@/lib/prisma': { prisma } }, { AUTH_SECRET: 'unit-test-only' });
  const results = await Promise.all(Array.from({ length: 25 }, () => allowAuthAttempt('login', 'test@example.invalid', request({}))));
  assert.equal(results.filter(Boolean).length, 10);
  const broken = load('src/lib/rate-limit.ts', { '@/lib/prisma': { prisma: { $queryRaw: async () => { throw Error('offline'); } } } }, { AUTH_SECRET: 'unit-test-only' });
  await assert.rejects(broken.allowAuthAttempt('login', 'test@example.invalid', request({})));
});

test('SMTP uses verified TLS, bounded timeouts, private credentials and no protocol logging', async () => {
  let options, mail, closed = false;
  const { sendPasswordResetEmail } = load('src/lib/password-reset-email.ts', {
    nodemailer: { createTransport: value => {
      options = value; return { sendMail: async value => { mail = value; }, close: () => { closed = true; } };
    } },
  }, { NODE_ENV: 'production', SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'test', SMTP_PASS: 'test-only', SMTP_FROM: 'no-reply@example.invalid' });
  await sendPasswordResetEmail('test@example.invalid', 'https://example.invalid/?resetToken=test');
  assert.equal(options.requireTLS, true); assert.equal(options.debug, false); assert.equal(options.logger, false);
  assert.equal(options.socketTimeout, 15000); assert.equal(closed, true);
  assert.equal(mail.from.name, 'Nexus Setups');
  assert.equal(mail.from.address, 'no-reply@example.invalid');
  assert.equal(mail.subject, 'Reset your Nexus Setups password'); assert.match(mail.text, /30 minutes/);
  assert.match(mail.html, /Reset password/);
});

test('reset diagnostics distinguish every pre-SMTP exit and never log secrets', async () => {
  const generic = { message: 'If that account exists, a password reset link has been requested.' };
  const smtp = {
    NODE_ENV: 'production', AUTH_URL: 'https://nexus-setups.vercel.app',
    SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'private-user', SMTP_PASS: 'private-password', SMTP_FROM: 'private-sender@example.invalid',
  };
  async function run({ env = {}, allowed = true, known = true, failStage, smtpError } = {}) {
    const logs = [];
    let attempted = 0, closed = 0, saved;
    const logger = { log: (...args) => logs.push(args), error: (...args) => logs.push(args) };
    const environment = { ...smtp, ...env };
    const serverLog = load('src/lib/server-log.ts', {}, environment, logger);
    const mailer = load('src/lib/password-reset-email.ts', {
      nodemailer: { createTransport: () => ({
        sendMail: async () => { attempted++; if (smtpError) throw smtpError; },
        close: () => { closed++; },
      }) },
    }, environment, logger);
    const fail = () => { throw Object.assign(new Error('private database URL'), { code: 'P2024' }); };
    const db = {
      user: { findUnique: async () => {
        if (failStage === 'user_lookup') fail();
        return known ? { id: 'private-id', email: 'private-recipient@example.invalid' } : null;
      } },
      $transaction: async fn => {
        if (failStage === 'token_persistence') fail();
        return fn({ user: { findUnique: async () => ({ email: "private-recipient@example.invalid" }) }, $queryRaw: async () => [], passwordResetToken: {
          deleteMany: async () => {}, create: async ({ data }) => { saved = data; },
        } });
      },
    };
    const { POST } = load('src/app/api/auth/password-reset/request/route.ts', {
      'next/server': responseMock, '@/lib/prisma': { prisma: db },
      '@/lib/rate-limit': { allowAuthAttempt: async () => {
        if (failStage === 'rate_limit') fail();
        return allowed;
      } },
      '@/lib/password-reset-email': mailer, '@/lib/server-log': serverLog,
    }, environment, logger);
    const response = await POST(request({ email: 'private-recipient@example.invalid' }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), generic);
    const serialized = JSON.stringify(logs);
    assert.doesNotMatch(serialized, /private-|resetToken|tokenHash|database URL/);
    if (saved) assert.ok(!serialized.includes(saved.tokenHash));
    return { attempted, closed, logs: serialized };
  }
  for (const field of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    const result = await run({ env: { [field]: '' } });
    assert.equal(result.attempted, 0);
    assert.match(result.logs, /SMTP_CONFIG_MISSING/);
    assert.match(result.logs, /"smtpConfigured":false/);
  }
  for (const env of [{ SMTP_SECURE: 'FALSE' }, { SMTP_PORT: 'invalid' }, { SMTP_PORT: '0' }, { SMTP_PORT: '65536' }]) {
    const result = await run({ env });
    assert.equal(result.attempted, 0);
    assert.match(result.logs, /SMTP_CONFIG_INVALID/);
  }
  for (const failStage of ['rate_limit', 'user_lookup', 'token_persistence']) {
    const result = await run({ failStage });
    assert.equal(result.attempted, 0);
    assert.ok(result.logs.includes(`"stage":"${failStage}","failed":true`));
  }
  const throttled = await run({ allowed: false });
  assert.equal(throttled.attempted, 0); assert.match(throttled.logs, /"allowed":false/);
  const unknown = await run({ known: false });
  assert.equal(unknown.attempted, 0); assert.match(unknown.logs, /"userFound":false/);
  const invalidOrigin = await run({ env: { AUTH_URL: 'http://example.invalid' } });
  assert.equal(invalidOrigin.attempted, 0); assert.match(invalidOrigin.logs, /"stage":"reset_url","failed":true/);
  const success = await run();
  assert.equal(success.attempted, 1); assert.equal(success.closed, 1);
  assert.match(success.logs, /smtp_accepted/);
  for (const code of ['EAUTH', 'EDNS', 'ETLS', 'private-provider-code']) {
    const result = await run({ smtpError: Object.assign(new Error('private SMTP response'), { code }) });
    assert.equal(result.attempted, 1); assert.equal(result.closed, 1);
    assert.match(result.logs, /Password reset email delivery failed/);
    assert.ok(result.logs.includes(code.startsWith('private') ? 'INTERNAL_ERROR' : code));
    assert.doesNotMatch(result.logs, /smtp_accepted/);
  }
});

test('SMTP omission skips delivery only outside production', async () => {
  for (const mode of ['development', 'test', 'production']) {
    let created = false;
    const { sendPasswordResetEmail } = load('src/lib/password-reset-email.ts', {
      nodemailer: { createTransport: () => { created = true; } },
    }, { NODE_ENV: mode });
    const result = sendPasswordResetEmail('test@example.invalid', 'https://example.invalid/?resetToken=private');
    if (mode === 'production') await assert.rejects(result, { code: 'SMTP_CONFIG_MISSING' });
    else await result;
    assert.equal(created, false);
  }
});

test('auth preserves both lifetimes and revokes sessions after password change', async () => {
  let config, version = 0;
  load('src/auth.ts', {
    'next-auth': value => { config = value; return {}; },
    'next-auth/providers/credentials': value => value,
    '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 'u', password: 'hash', accountType: 'EDITOR', sessionVersion: version }) } } },
    '@/lib/rate-limit': { allowAuthAttempt: async () => true }, '@/lib/server-log': quiet,
    bcryptjs: { compare: async () => true },
  });
  for (const [remember, seconds] of [[false, 8 * 3600], [true, 30 * 86400]]) {
    const user = await config.providers[0].authorize({ email: 'test@example.invalid', password: 'test-only', rememberSession: String(remember) }, request({}));
    assert.equal(user.rememberSession, remember);
    const token = await config.callbacks.jwt({ token: { sub: 'u' }, user });
    assert.ok(Math.abs(token.sessionExpiresAt - Date.now() - seconds * 1000) < 1000);
    version++;
    const revoked = await config.callbacks.jwt({ token });
    assert.equal(revoked.sub, undefined);
    assert.equal((await config.callbacks.session({ session: { user: {} }, token: revoked })).user, undefined);
  }
  const ui = fs.readFileSync('src/app/page.tsx', 'utf8');
  assert.match(ui, /rememberSession: String\(formData.get\("rememberSession"\) === "on"\)/);
  assert.match(ui, /type="checkbox" id="rememberSession" name="rememberSession"/);
});

async function zipFactory(archiver) {
  return load('src/lib/delivery-zip.ts', {
    archiver: archiver || await import('archiver'), '@/lib/server-log': quiet,
  }).createDeliveryZip;
}
test('ZIP opens one source at a time and produces a complete streaming archive', async () => {
  const factory = await zipFactory();
  let last, opened = 0;
  const zip = factory(Array.from({ length: 30 }, (_, i) => ({ key: `${i}`, name: `Supporting Files/${i}.txt` })), async () => {
    if (last) assert.equal(last.destroyed, true);
    opened++; last = Readable.from([Buffer.alloc(10000, 65)]); return last;
  }, new AbortController().signal);
  zip.start();
  const bytes = Buffer.from(await new Response(zip.stream).arrayBuffer());
  assert.equal(opened, 30); assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
});
test('ZIP client cancellation destroys active source without opening another', async () => {
  const factory = await zipFactory(); let source, opened = 0;
  const zip = factory([{ key: '1', name: 'one' }, { key: '2', name: 'two' }], async () => {
    opened++; source = new Readable({ read() { this.push(Buffer.alloc(64 * 1024)); } }); return source;
  }, new AbortController().signal);
  zip.start(); const reader = zip.stream.getReader(); await reader.read(); await reader.cancel();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(source.destroyed, true); assert.equal(opened, 1);
});
test('ZIP handles source and finalize failures, and request abort during object fetch', async () => {
  const factory = await zipFactory();
  const broken = factory([{ key: 'bad', name: 'bad' }], async () => new Readable({ read() { this.destroy(Error('private provider error')); } }), new AbortController().signal);
  broken.start(); await assert.rejects(new Response(broken.stream).arrayBuffer());
  const { ZipArchive } = await import('archiver');
  const finalizeFactory = await zipFactory({ ZipArchive: class extends ZipArchive { finalize() { return Promise.reject(Error('finalize failed')); } } });
  const final = finalizeFactory([], async () => Readable.from([]), new AbortController().signal);
  final.start(); await assert.rejects(new Response(final.stream).arrayBuffer());
  const abort = new AbortController(); let fetchSignal;
  const pending = factory([{ key: '1', name: 'one' }], async (_, signal) => {
    fetchSignal = signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true }));
  }, abort.signal);
  pending.start(); abort.abort();
  await assert.rejects(new Response(pending.stream).arrayBuffer()); assert.equal(fetchSignal.aborted, true);
});
