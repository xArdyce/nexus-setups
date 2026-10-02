const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Every import with external effects is replaced; no database or bucket credentials are read.
function load(file, db, extra = {}) {
  const mocks = {
    'next/server': { NextResponse: { json: (b, o) => Response.json(b, o), redirect: u => Response.redirect(u) } },
    '@/auth': { auth: async () => ({ user: { email: 'test@example.invalid' } }) },
    '@/lib/prisma': { prisma: db }, '@/lib/server-log': { logServerError() {} },
    '@/lib/notifications': {
      getAssignedEditorUserIds: async () => [], getCreatorAccountUserId: async () => null,
      getManagementUserIds: async () => [], notifyUsers: async () => {},
    },
    '@aws-sdk/client-s3': Object.fromEntries(['GetObjectCommand', 'DeleteObjectsCommand', 'HeadObjectCommand', 'PutObjectCommand'].map(n => [n, class { constructor(input) { this.input = input; } }])),
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async (_, command) => `https://storage.invalid/${command.input.Key}` },
    '@/lib/r2': { getR2BucketName: () => 'test', getR2Client: () => ({ send: async () => { throw Error('unexpected storage call'); } }), sanitizeR2FileName: s => s },
    ...extra,
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, {
    exports, require: n => { if (n in mocks) return mocks[n]; if (['crypto', 'node:stream'].includes(n)) return require(n); throw Error(`Unmocked import ${n}`); },
    Response, Request, URL, Date, Buffer, console: { error() {} },
  });
  return exports;
}
const ctx = (key, value) => ({ params: Promise.resolve({ [key]: value }) });
const req = (body, query = '') => new Request(`https://test.invalid/api${query}`, { method: 'POST', body: JSON.stringify(body) });
function user(role, accountType = role === 'CREATOR' ? 'CREATOR' : 'EDITOR') {
  return { id: 'u', accountType, creatorProfile: { id: 'creator', organizationId: 'org' }, memberships: [{ organizationId: 'org', role }] };
}
function matches(row, where) {
  return Object.entries(where || {}).every(([key, v]) => {
    if (key === 'OR') return v.some(w => matches(row, w));
    if (key === 'AND') return v.every(w => matches(row, w));
    if (v && typeof v === 'object') {
      if ('in' in v) return v.in.includes(row?.[key]);
      if ('some' in v) return (row?.[key] || []).some(x => matches(x, v.some));
      return matches(row?.[key], v);
    }
    return row?.[key] === v;
  });
}
function fixture(role, assignment = 'none', accountType) {
  const actor = user(role, accountType);
  const content = { id: 'content', title: 'Cut', status: 'REQUESTED', updatedAt: new Date(), editorAssignments: assignment === 'direct' ? [{ userId: 'u' }] : [], project: {
    id: 'project', organizationId: 'org', creatorId: 'creator', creator: { id: 'creator', editorAssignments: assignment === 'inherited' ? [{ userId: 'u' }] : [] },
  }, assets: [], reviews: [] };
  const task = { id: 'task', contentId: content.id, content };
  let writes = 0;
  const db = {
    user: { findUnique: async () => actor },
    contentItem: { findUnique: async () => content, findFirst: async ({ where }) => matches(content, where) ? content : null, update: async ({ data }) => { writes++; Object.assign(content, data); return content; } },
    task: { findUnique: async () => task, findMany: async () => [], create: async ({ data }) => { writes++; return data; }, update: async ({ data }) => { writes++; return data; }, delete: async () => { writes++; } },
    auditLog: { create: async () => {}, findMany: async () => [] },
    assetVersion: { findFirst: async () => ({ id: 'version' }) },
    review: { findFirst: async () => null, create: async ({ data }) => { writes++; return data; } },
    $queryRaw: async () => [],
  };
  db.$transaction = fn => fn(db);
  return { actor, content, db, writes: () => writes };
}

for (const [role, assignment, allowed] of [['CREATOR','none',true], ['EDITOR','direct',true], ['EDITOR','inherited',true], ['EDITOR','none',false], ['MANAGER','none',true], ['ADMIN','none',true]]) {
  test(`task target authorization: ${role}/${assignment}`, async () => {
    const f = fixture(role, assignment);
    const route = load('src/app/api/tasks/[taskId]/route.ts', f.db);
    assert.equal((await route.PATCH(req({ status: 'IN_PROGRESS' }), ctx('taskId','task'))).status, allowed ? 200 : 403);
    const manage = role !== 'EDITOR';
    assert.equal((await route.PATCH(req({ title: 'Changed' }), ctx('taskId','task'))).status, manage ? 200 : 403);
    assert.equal((await route.DELETE(req({}), ctx('taskId','task'))).status, manage ? 200 : 403);
    const create = load('src/app/api/tasks/route.ts', f.db);
    assert.equal((await create.POST(req({ title: 'Task', contentId:'content' }))).status, manage ? 201 : 403);
  });
}
test('Creator cannot mutate another Creator task; account type cannot confer Creator permissions', async () => {
  for (const change of [f => { f.content.project.creatorId = 'other'; }, f => { f.actor.memberships = []; }]) {
    const f = fixture('CREATOR'); change(f);
    const route = load('src/app/api/tasks/[taskId]/route.ts', f.db);
    assert.equal((await route.PATCH(req({ status:'COMPLETED' }), ctx('taskId','task'))).status,403);
    assert.equal(f.writes(),0);
  }
});
test('management roles work even with a Creator account type', async () => {
  const f = fixture('ADMIN','none','CREATOR');
  const route = load('src/app/api/projects/[projectId]/route.ts',f.db);
  assert.equal((await route.PATCH(req({ status:'IN_PRODUCTION' }),ctx('projectId','content'))).status,200);
});
test('production transition matrix, terminal approval, and alternate decision bypass', async () => {
  const transitions = { REQUESTED:['IN_PRODUCTION'], IN_PRODUCTION:['IN_REVIEW'], REVISION:['IN_PRODUCTION','IN_REVIEW'], IN_REVIEW:[], APPROVED:[] };
  for (const role of ['EDITOR','ADMIN','MANAGER','CREATOR']) for (const from of Object.keys(transitions)) for (const to of Object.keys(transitions)) {
    const f = fixture(role,'direct'); f.content.status = from;
    const route = load('src/app/api/projects/[projectId]/route.ts',f.db);
    const result = await route.PATCH(req({ status:to }),ctx('projectId','content'));
    const allowed = role !== 'CREATOR' && transitions[from].includes(to);
    assert.equal(result.status === 200,allowed,`${role} ${from} -> ${to}`);
    if (!allowed) assert.equal(f.writes(),0);
  }
});
test('review submission requires an uploaded version and binds the exact selected version', async () => {
  const f = fixture('EDITOR','inherited'); f.content.status = 'IN_PRODUCTION';
  let binding;
  f.db.review.create = async ({ data }) => { binding = data.assetVersionId; return data; };
  const route = load('src/app/api/projects/[projectId]/route.ts',f.db);
  assert.equal((await route.PATCH(req({ status:'IN_REVIEW' }),ctx('projectId','content'))).status,200);
  assert.equal(binding,'version');
  f.content.status = 'IN_PRODUCTION'; f.db.assetVersion.findFirst = async () => null;
  assert.equal((await route.PATCH(req({ status:'IN_REVIEW' }),ctx('projectId','content'))).status,409);
});
function decisionFixture(role = 'CREATOR') {
  const f = fixture(role,'direct'); f.content.status = 'IN_REVIEW';
  const review = { id:'review', status:'PENDING', content:f.content, assetVersionId:'version', assetVersion:{ id:'version', version:1, assetId:'asset', asset:{ id:'asset', contentId:'content', assetType:'VIDEO' } } };
  f.db.review = { findUnique:async () => review, findFirst:async () => ({ id:'review' }), update:async ({ data }) => { Object.assign(review,data); return review; } };
  f.db.reviewComment = { count:async () => 1 };
  return { ...f,review };
}
test('unresolved safeguard and confirmation do not bypass decision authorization', async () => {
  for (const role of ['CREATOR','EDITOR','ADMIN','MANAGER']) {
    const f = decisionFixture(role);
    const route = load('src/app/api/reviews/[reviewId]/decision/route.ts',f.db);
    assert.equal((await route.POST(req({ decision:'APPROVE' }),ctx('reviewId','review'))).status,role === 'EDITOR' ? 403 : 409);
    assert.equal((await route.POST(req({ decision:'APPROVE',confirmUnresolved:true }),ctx('reviewId','review'))).status,role === 'EDITOR' ? 403 : 200);
    assert.equal(f.review.assetVersionId,'version');
  }
  const f = decisionFixture(); f.content.project.creatorId='other';
  assert.equal((await load('src/app/api/reviews/[reviewId]/decision/route.ts',f.db).POST(req({decision:'APPROVE',confirmUnresolved:true}),ctx('reviewId','review'))).status,403);
});
test('stale, resolved, unbound and cross-content reviews are rejected; revisions retain binding', async () => {
  for (const mutate of [f => { f.review.status='APPROVED'; }, f => { f.review.assetVersion=null; }, f => { f.review.assetVersion.asset.contentId='other'; }, f => { f.db.review.findFirst=async () => ({id:'newer'}); }]) {
    const f = decisionFixture(); mutate(f);
    assert.equal((await load('src/app/api/reviews/[reviewId]/decision/route.ts',f.db).POST(req({decision:'APPROVE',confirmUnresolved:true}),ctx('reviewId','review'))).status,409);
  }
  const f = decisionFixture(); const route = load('src/app/api/reviews/[reviewId]/decision/route.ts',f.db);
  assert.equal((await route.POST(req({decision:'REQUEST_REVISION',notes:'Fix the cut'}),ctx('reviewId','review'))).status,200);
  assert.equal(f.content.status,'REVISION'); assert.equal(f.review.assetVersionId,'version');
  assert.equal((await route.POST(req({decision:'APPROVE',confirmUnresolved:true}),ctx('reviewId','review'))).status,409);
});
test('historical downloads enforce assignment and select a version only from the authorized asset', async () => {
  for (const assignment of ['none','direct','inherited']) {
    const f = fixture('EDITOR',assignment);
    const asset = {id:'asset',content:f.content,storageKey:'current',fileName:'current.mp4',versions:[{version:1,storageKey:'historical',fileName:'old.mp4'}]};
    f.db.asset = {findFirst:async ({where}) => matches(asset,where) ? asset : null};
    const route = load('src/app/api/assets/[assetId]/download/route.ts',f.db);
    const result = await route.GET(new Request('https://test.invalid/api?version=1'),ctx('assetId','asset'));
    assert.equal(result.status,assignment === 'none' ? 404 : 302);
    if (assignment !== 'none') {
      assert.match(result.headers.get('location'),/historical$/);
      assert.equal((await route.GET(new Request('https://test.invalid/api?version=2'),ctx('assetId','asset'))).status,404);
      assert.equal((await route.GET(new Request('https://test.invalid/api?version=1'),ctx('assetId','other'))).status,404);
    }
  }
});
test('upload URL rejects cross-project assetId before touching storage', async () => {
  const f = fixture('EDITOR','direct'); f.db.asset={findFirst:async () => null};
  const route = load('src/app/api/assets/upload-url/route.ts',f.db);
  assert.equal((await route.POST(req({contentId:'content',assetId:'foreign',fileName:'cut.mp4',fileSize:10}))).status,404);
});
test('asset deletion preserves bound review versions and retains DB records on R2 errors', async () => {
  const f = fixture('ADMIN');
  const asset={id:'asset',content:f.content,storageKey:'current',versions:[{storageKey:'old'}]};
  f.db.asset = {findFirst:async () => asset,findUnique:async () => asset,delete:async () => {throw Error('must not delete');}};
  f.db.review.findFirst=async () => ({id:'review'});
  const route = load('src/app/api/assets/[assetId]/route.ts',f.db);
  assert.equal((await route.DELETE(req({}),ctx('assetId','asset'))).status,409);
  f.db.review.findFirst=async () => null;
  const errorRoute = load('src/app/api/assets/[assetId]/route.ts',f.db,{'@/lib/r2':{getR2BucketName:()=> 'test',getR2Client:()=> ({send:async () => ({Errors:[{Key:'old'}]})})}});
  assert.equal((await errorRoute.DELETE(req({}),ctx('assetId','asset'))).status,500);
});
test('direct assignment activity does not expose sibling content under the same Creator', async () => {
  const f = fixture('EDITOR','direct');
  f.db.contentItem.findMany=async () => [f.content]; f.db.creatorAssignment={findMany:async () => []};
  f.db.auditLog.findMany=async () => ['content','sibling'].map(id => ({id,resource:'ContentItem',resourceId:id,metadata:{creatorId:'creator',contentId:id}}));
  const response=await load('src/app/api/activity/route.ts',f.db).GET(new Request('https://test.invalid/api?organizationId=org'));
  assert.deepEqual((await response.json()).activity.map(x=>x.id),['content']);
});
test('delivery requires authorized APPROVED content and uses canonical approved version, not current file', async () => {
  for (const [role,assignment,allowed] of [['CREATOR','none',true],['EDITOR','none',false],['EDITOR','direct',true],['EDITOR','inherited',true],['MANAGER','none',true],['ADMIN','none',true]]) {
    const f=fixture(role,assignment); f.content.status='APPROVED';
    f.content.assets=[{id:'asset',storageKey:'new-unapproved'},{id:'support',storageKey:'support',fileName:'notes.txt'}];
    f.content.reviews=[{id:'approved',assetVersion:{id:'version',assetId:'asset',storageKey:'approved-old',fileName:'cut.mp4',asset:{contentId:'content'}}}];
    let entries,audit;
    f.db.auditLog.create=async ({data}) => {audit=data;};
    const route=load('src/app/api/projects/[projectId]/delivery/route.ts',f.db,{
      '@/lib/delivery-zip':{createDeliveryZip: e => {entries=e;return {stream:new ReadableStream({start(c){c.close();}}),start(){},cancel(){}};}},
    });
    assert.equal((await route.GET(new Request('https://test.invalid/api'),ctx('projectId','content'))).status,allowed ? 200 : 404);
    if (allowed) {
      assert.deepEqual(Array.from(entries,e=>e.key),['approved-old','support']);
      assert.equal(audit.metadata.approvedAssetVersionId,'version'); assert.equal(audit.metadata.transferStatus,'initiated');
      f.content.status='IN_REVIEW';
      assert.equal((await route.GET(new Request('https://test.invalid/api'),ctx('projectId','content'))).status,404);
      f.content.status='APPROVED'; f.content.reviews.unshift({id:'latest',assetVersion:null});
      assert.equal((await route.GET(new Request('https://test.invalid/api'),ctx('projectId','content'))).status,409);
    }
  }
});

test('review comments scope commentId to reviewId and enforce author ownership', async () => {
  const f = decisionFixture('EDITOR');
  f.db.reviewComment={findFirst:async ({where}) => where.reviewId === 'review' && where.id === 'comment' ? {id:'comment',authorId:'other'} : null};
  const route=load('src/app/api/reviews/[reviewId]/comments/route.ts',f.db);
  assert.equal((await route.PATCH(req({action:'EDIT',commentId:'foreign',comment:'changed'}),ctx('reviewId','review'))).status,404);
  assert.equal((await route.PATCH(req({action:'EDIT',commentId:'comment',comment:'changed'}),ctx('reviewId','review'))).status,403);
  assert.equal((await route.DELETE(req({commentId:'comment'}),ctx('reviewId','review'))).status,403);
  f.db.contentItem.findFirst=async () => null;
  assert.equal((await route.PATCH(req({action:'RESOLVE',commentId:'comment',resolved:true}),ctx('reviewId','review'))).status,404);
});
test('assignment management rejects Editor and foreign organization targets', async () => {
  for (const role of ['EDITOR','CREATOR','ADMIN','MANAGER']) {
    const f=fixture(role,'direct');
    if (role === 'ADMIN' || role === 'MANAGER') f.content.project.organizationId='foreign';
    const route=load('src/app/api/projects/[projectId]/assignments/route.ts',f.db);
    assert.equal((await route.POST(req({userId:'editor'}),ctx('projectId','content'))).status,404);
    assert.equal((await route.DELETE(req({userId:'editor'}),ctx('projectId','content'))).status,404);
    f.db.creator={findFirst:async () => null};
    const creators=load('src/app/api/creators/[creatorId]/assignments/route.ts',f.db);
    assert.equal((await creators.POST(req({userId:'editor'}),ctx('creatorId','foreign'))).status,404);
  }
});
test('project creation denies Editors and Creator organization manipulation', async () => {
  for (const [role,organizationId] of [['EDITOR','org'],['CREATOR','foreign']]) {
    const f=fixture(role,'direct');
    const route=load('src/app/api/projects/route.ts',f.db);
    assert.equal((await route.POST(req({title:'Cut',type:'Short-form',footageLink:'https://drive.google.com/drive/folders/test',organizationId}))).status,403);
    assert.equal(f.writes(),0);
  }
});
test('asset registration rejects foreign content, asset target, and version key prefix', async () => {
  for (const [contentId,assetId,storageKey] of [['foreign','','organizations/org/content/foreign/file'],['content','foreign','organizations/org/content/content/file'],['content','asset','organizations/org/content/content/assets/foreign/versions/file']]) {
    const f=fixture('EDITOR','direct'); f.db.asset={findFirst:async ({where}) => where.id === 'asset' && where.contentId === 'content' ? {id:'asset',assetType:'VIDEO'} : null};
    const route=load('src/app/api/assets/route.ts',f.db);
    assert.equal((await route.POST(req({contentId,assetId,storageKey,fileName:'cut.mp4',assetType:'VIDEO'}))).status,contentId === 'foreign' || assetId === 'foreign' ? 404 : 400);
  }
});
test('project deletion removes current/historical R2 objects before DB deletion and stops on R2 errors', async () => {
  for (const fail of [false,true]) {
    const f=fixture('CREATOR'); f.content.assets=[{storageKey:'current',versions:[{storageKey:'current'},{storageKey:'old'}]}];
    const steps=[];
    f.db.contentItem.delete=async () => {steps.push('database');};
    const route=load('src/app/api/projects/[projectId]/route.ts',f.db,{'@/lib/r2':{getR2BucketName:()=> 'test',getR2Client:()=> ({send:async command => {
      assert.deepEqual(Array.from(command.input.Delete.Objects,o=>o.Key),['current','old']);steps.push('storage');return fail ? {Errors:[{Key:'old'}]} : {};
    }})}});
    assert.equal((await route.DELETE(req({}),ctx('projectId','content'))).status,fail ? 500 : 200);
    assert.deepEqual(steps,fail ? ['storage'] : ['storage','database']);
  }
});
test('a competing decision that changed status is rejected after acquiring the lock', async () => {
  const f=decisionFixture();
  f.db.$queryRaw=async () => {f.review.status='REVISION_REQUESTED';f.content.status='REVISION';};
  const route=load('src/app/api/reviews/[reviewId]/decision/route.ts',f.db);
  assert.equal((await route.POST(req({decision:'APPROVE',confirmUnresolved:true}),ctx('reviewId','review'))).status,409);
  assert.equal(f.review.status,'REVISION_REQUESTED');
});

test('presigned PUT signs create-only condition so it cannot overwrite registered version bytes', async () => {
  const f=fixture('EDITOR','direct');
  const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3');
  const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
  const client=new S3Client({region:'auto',endpoint:'https://test.r2.cloudflarestorage.com',credentials:{accessKeyId:'test-only',secretAccessKey:'test-only'}});
  try {
    const route=load('src/app/api/assets/upload-url/route.ts',f.db,{
      '@aws-sdk/client-s3':{PutObjectCommand},'@aws-sdk/s3-request-presigner':{getSignedUrl},
      '@/lib/r2':{getR2BucketName:()=> 'test',getR2Client:()=> client,sanitizeR2FileName:s=>s},
    });
    const response=await route.POST(req({contentId:'content',fileName:'cut.mp4',fileSize:10,mimeType:'video/mp4'}));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.requiredHeaders['If-None-Match'],'*');
    const headers=new URL(body.uploadUrl).searchParams.get('X-Amz-SignedHeaders');
    assert.ok(headers.split(';').includes('if-none-match'));
    assert.ok(headers.split(';').includes('content-type'));
  } finally {client.destroy();}
});
