const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, db, extra = {}, env = {}) {
  const mocks = {
    'next/server': { NextResponse: { json: (b, o) => Response.json(b, o) } },
    '@/auth': { auth: async () => ({ user: { email: 'test@example.invalid' } }) },
    '@/lib/prisma': { prisma: db }, '@/lib/server-log': { logServerError() {} },
    '@/lib/rate-limit': { allowAuthAttempt: async () => true },
    bcryptjs: { compare: async (plain) => plain === 'current-password', hash: async () => 'new-hash' },
    '@aws-sdk/client-s3': { HeadObjectCommand: class { constructor(input) { this.input = input; } } },
    ...extra,
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, {
    exports, require: n => { if (n in mocks) return mocks[n]; if (n === 'node:crypto') return require(n); throw Error(`Unmocked import: ${n}`); },
    process: { env }, Response, Request, URL, Date, Buffer, console: { log() {}, error() {} },
  });
  return exports;
}
const request = (body, url = 'https://test.invalid/api') => new Request(url, { method: 'POST', body: JSON.stringify(body) });
function assets(head = { ContentLength: 10, ContentType: 'video/mp4' }) {
  const content = { id: 'content', title: 'Cut', contentType: 'Short-form', project: { id:'project', name:'Project', organizationId: 'org', creatorId: 'creator' } };
  const asset = { id:'asset',contentId:'content',content,assetType:'VIDEO',storageKey:'initial',versions:[{id:'v1',version:1,storageKey:'initial'}] };
  const db = {
    user:{findUnique:async () => ({id:'u',memberships:[{role:'ADMIN',organizationId:'org'}]})},
    contentItem:{findFirst:async () => content,findUnique:async () => content},
    asset:{findFirst:async () => asset,findUnique:async ({where}) => where.storageKey === asset.storageKey ? asset : null,update:async ({data}) => {Object.assign(asset,data);return asset;}},
    assetVersion:{findFirst:async ({where}) => where.storageKey ? asset.versions.find(v=>v.storageKey===where.storageKey) || null : asset.versions.at(-1),create:async ({data}) => {asset.versions.push({id:`v${data.version}`, ...data});return data;}},
    auditLog:{create:async () => {}}, $queryRaw:async () => [],
  };
  // Model the shared ContentItem lock: concurrent callbacks execute in lock order.
  let queue = Promise.resolve();
  db.$transaction=fn => {const result=queue.then(()=>fn(db));queue=result.catch(()=>{});return result;};
  const route=load('src/app/api/assets/route.ts',db,{'@/lib/r2':{getR2BucketName:()=> 'test',getR2Client:()=> ({send:async () => head})}});
  const body={contentId:'content',assetId:'asset',storageKey:'organizations/org/content/content/assets/asset/versions/object',fileName:'cut.mp4',assetType:'VIDEO',fileSize:10};
  return {route,body,db,asset};
}
test('concurrent duplicate registration returns one success and one conflict without duplicate versions', async () => {
  const f=assets();
  const results=await Promise.all([f.route.POST(request(f.body)),f.route.POST(request(f.body))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal(f.asset.versions.length,2);
});
test('concurrent distinct uploads create sequential versions under the shared lock', async () => {
  const f=assets();
  const results=await Promise.all(['one','two'].map(leaf=>f.route.POST(request({...f.body,storageKey:f.body.storageKey+leaf}))));
  assert.deepEqual(results.map(r=>r.status),[201,201]);
  assert.deepEqual(f.asset.versions.map(v=>v.version),[1,2,3]);
});
test('registration rejects invalid actual size/MIME metadata before DB writes', async () => {
  for (const head of [{ContentLength:0,ContentType:'video/mp4'},{ContentLength:5*1024**3+1,ContentType:'video/mp4'},{ContentType:'video/mp4'},{ContentLength:10},{ContentLength:10,ContentType:'text/html'},{ContentLength:11,ContentType:'video/mp4'}]) {
    const f=assets(head);
    assert.equal((await f.route.POST(request(f.body))).status,400);
    assert.equal(f.asset.versions.length,1);
  }
});
test('registration rejects path/control manipulation and a deleted project after locking', async () => {
  for (const leaf of ['../foreign','nested/key','..','bad\\key','bad\nkey']) {
    const f=assets();
    f.body.storageKey='organizations/org/content/content/assets/asset/versions/'+leaf;
    assert.equal((await f.route.POST(request(f.body))).status,400);
  }
  const f=assets();f.db.contentItem.findUnique=async () => null;
  assert.equal((await f.route.POST(request(f.body))).status,409);
  assert.equal(f.asset.versions.length,1);
});
test('password changes invalidate reset links and sessions atomically; stale credentials cannot overwrite a reset', async () => {
  for (const stale of [false,true]) {
    const actor={id:'u',email:'test@example.invalid',password:'old-hash',memberships:[]};let revoked=0,updated=0;
    const db={user:{findUnique:async () => actor,updateMany:async ({where,data}) => {
      assert.equal(where.password,'old-hash');assert.equal(data.sessionVersion.increment,1);
      if (stale) return {count:0};updated++;return {count:1};
    }},passwordResetToken:{deleteMany:async ({where}) => {assert.equal(where.userId,'u');revoked++;}},$queryRaw:async () => []};
    db.$transaction=fn=>fn(db);
    const route=load('src/app/api/settings/route.ts',db);
    assert.equal((await route.PATCH(request({action:'PASSWORD',currentPassword:'current-password',newPassword:'new-password'}))).status,stale ? 409 : 200);
    assert.equal(updated,stale ? 0 : 1);assert.equal(revoked,stale ? 0 : 1);
  }
});
test('bcrypt byte limit is enforced on signup, reset and settings, including Unicode', async () => {
  const oversized='😀'.repeat(19);
  assert.equal(Buffer.byteLength(oversized),76);
  assert.equal((await load('src/app/api/signup/route.ts',{}).POST(request({name:'Test',email:'test@example.invalid',password:oversized,accountType:'CREATOR'}))).status,400);
  assert.equal((await load('src/app/api/auth/password-reset/confirm/route.ts',{}).POST(request({token:'a'.repeat(64),password:oversized}))).status,400);
  const db={user:{findUnique:async () => ({id:'u',password:'hash',memberships:[]})}};
  assert.equal((await load('src/app/api/settings/route.ts',db).PATCH(request({action:'PASSWORD',currentPassword:'current-password',newPassword:oversized}))).status,400);
});
test('signup and credential verification stop before expensive work when rate limited', async () => {
  const denied={'@/lib/rate-limit':{allowAuthAttempt:async () => false}};
  assert.equal((await load('src/app/api/signup/route.ts',{},denied).POST(request({name:'Test',email:'test@example.invalid',password:'test-password',accountType:'CREATOR'}))).status,429);
  const db={user:{findUnique:async () => ({id:'u',password:'hash',memberships:[]})}};
  assert.equal((await load('src/app/api/settings/route.ts',db,denied).PATCH(request({action:'PASSWORD'}))).status,429);
});
test('production reset URLs fail closed without a canonical HTTPS origin, preserving generic responses', async () => {
  for (const authUrl of [undefined,'http://insecure.invalid','https://user:password@host.invalid']) {
    let persisted=false,sent=false;
    const db={user:{findUnique:async () => ({id:'u',email:'test@example.invalid'})},$transaction:async () => {persisted=true;}};
    const route=load('src/app/api/auth/password-reset/request/route.ts',db,{'@/lib/password-reset-email':{sendPasswordResetEmail:async () => {sent=true;}}},{NODE_ENV:'production',AUTH_URL:authUrl});
    const response=await route.POST(request({email:'test@example.invalid'},'https://attacker.invalid/api'));
    assert.equal(response.status,200);assert.equal((await response.json()).message,'If that account exists, a password reset link has been requested.');
    assert.equal(persisted,false);assert.equal(sent,false);
  }
});
test('Creator linkage rejects another organization and default-project failure rolls back Creator creation', async () => {
  for (const foreign of [true,false]) {
    let created=false;
    const db={user:{findUnique:async ({where}) => where.email ? {id:'admin',memberships:[{role:'ADMIN',organizationId:'org'}]} : {id:'creator-user',accountType:'CREATOR'}},
      organizationMember:{findFirst:async () => foreign ? null : {id:'membership'}},
      creator:{findUnique:async () => null,create:async () => {created=true;return {id:'creator'};}},project:{create:async () => {throw Error('project failure');}}};
    db.$transaction=async fn=> {try{return await fn(db);}catch(e){created=false;throw e;}};
    const response=await load('src/app/api/creators/route.ts',db).POST(request({name:'Creator',organizationId:'org',userId:'creator-user'}));
    assert.equal(response.status,foreign ? 400 : 500);assert.equal(created,false);
  }
});
test('invalid task dates return a validation error before Prisma mutation', async () => {
  const actor={id:'u',memberships:[{role:'ADMIN',organizationId:'org'}]};const content={id:'content',project:{organizationId:'org'}};
  const db={user:{findUnique:async () => actor},task:{findUnique:async () => ({id:'task',content})}};
  const route=load('src/app/api/tasks/[taskId]/route.ts',db);
  assert.equal((await route.PATCH(request({dueDate:'invalid'}),{params:Promise.resolve({taskId:'task'})})).status,400);
});

test('email changes revoke old sessions/reset links and condition updates on the verified password', async () => {
  const actor={id:'u',email:'test@example.invalid',password:'old-hash',memberships:[]};let revoked=0;
  const db={user:{findUnique:async ({where}) => where.email === 'new@example.invalid' ? null : actor,update:async ({where,data}) => {
    assert.equal(where.password,'old-hash');assert.equal(data.sessionVersion.increment,1);
  }},passwordResetToken:{deleteMany:async () => {revoked++;}},$queryRaw:async () => []};
  db.$transaction=fn=>fn(db);
  const result=await load('src/app/api/settings/route.ts',db).PATCH(request({action:'PROFILE',name:'Test',email:'new@example.invalid',currentPassword:'current-password'}));
  assert.equal(result.status,200);assert.equal(revoked,1);
});
test('Creator detail edits reject a lifecycle change after acquiring the content lock', async () => {
  const content={id:'content',status:'REQUESTED',project:{organizationId:'org',creator:{id:'creator'}}};let writes=0;
  const actor={id:'u',creatorProfile:{id:'creator',organizationId:'org'},memberships:[{organizationId:'org',role:'CREATOR'}]};
  const db={user:{findUnique:async () => actor},contentItem:{findFirst:async () => content,findUnique:async () => ({status:'APPROVED'}),update:async () => {writes++;}},$queryRaw:async () => []};
  db.$transaction=fn=>fn(db);
  const result=await load('src/app/api/projects/[projectId]/route.ts',db,{
    '@aws-sdk/client-s3':{DeleteObjectsCommand:class {}},'@/lib/r2':{},
    '@/lib/notifications':{getCreatorAccountUserId:async () => null,notifyUsers:async () => {}},
  }).PATCH(request({title:'Changed'}),{params:Promise.resolve({projectId:'content'})});
  assert.equal(result.status,409);assert.equal(writes,0);
});
test('asset filename search never passes arbitrary search text into the AssetType enum',async () => {
  const db={user:{findUnique:async () => ({id:'u',memberships:[{organizationId:'org',role:'ADMIN'}]})},asset:{findMany:async ({where}) => {
    for (const clause of where.OR) if (clause.assetType) assert.ok(['VIDEO','IMAGE','AUDIO','DOCUMENT','OTHER'].includes(clause.assetType.equals));
    return [];
  }}};
  const route=load('src/app/api/assets/route.ts',db,{'@/lib/r2':{}});
  assert.equal((await route.GET(new Request('https://test.invalid/api?organizationId=org&search=my-cut'))).status,200);
});
test('reset requests do not issue a new link to an address changed while waiting for the User lock',async () => {
  let saved=false,sent=false;
  const db={user:{findUnique:async () => ({id:'u',email:'old@example.invalid'})}};
  db.$transaction=fn=>fn({$queryRaw:async () => [],user:{findUnique:async () => ({email:'new@example.invalid'})},passwordResetToken:{create:async () => {saved=true;},deleteMany:async () => {}}});
  const route=load('src/app/api/auth/password-reset/request/route.ts',db,{'@/lib/password-reset-email':{sendPasswordResetEmail:async () => {sent=true;}}},{NODE_ENV:'production',AUTH_URL:'https://test.invalid'});
  assert.equal((await route.POST(request({email:'old@example.invalid'}))).status,200);
  assert.equal(saved,false);assert.equal(sent,false);
});
