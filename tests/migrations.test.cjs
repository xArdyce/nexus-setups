const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {PGlite}=require('@electric-sql/pglite');

async function migrate(db) {
  for (const folder of fs.readdirSync('prisma/migrations').sort()) {
    const file=path.join('prisma/migrations',folder,'migration.sql');
    if (fs.existsSync(file)) await db.exec(fs.readFileSync(file,'utf8'));
  }
}
test('all migrations replay offline and match current schema tables, columns, enums, FKs and indexes',async () => {
  const actual=new PGlite();const expected=new PGlite();
  try {
    await migrate(actual);
    // These flags only parse schema files. They never connect to DATABASE_URL.
    const sql=execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],{
      encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://test:test@127.0.0.1:1/offline'},stdio:['ignore','pipe','pipe'],
    });
    await expected.exec(sql);
    const queries=[
      `SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`,
      `SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid ORDER BY t.typname,e.enumsortorder`,
      `SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND k.contype <> 'c' ORDER BY c.relname,k.conname`,
      `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
    ];
    for (const query of queries) assert.deepEqual((await actual.query(query)).rows,(await expected.query(query)).rows);
  } finally {await actual.close();await expected.close();}
});
test('PostgreSQL enforces version/object uniqueness, one pending Review, assignments and cascade cleanup',async () => {
  const db=new PGlite();
  try {
    await migrate(db);
    await db.exec(`INSERT INTO "User" (id,email,"accountType","updatedAt") VALUES ('u','test@example.invalid','CREATOR',now());
      INSERT INTO "Organization" (id,name,"updatedAt") VALUES ('org','Test',now());
      INSERT INTO "Creator" (id,name,"organizationId","updatedAt") VALUES ('creator','Creator','org',now());
      INSERT INTO "Project" (id,name,"organizationId","creatorId","createdById","updatedAt") VALUES ('project','Project','org','creator','u',now());
      INSERT INTO "ContentItem" (id,title,"contentType","projectId","updatedAt") VALUES ('content','Cut','Short-form','project',now());
      INSERT INTO "Asset" (id,"fileName","storageKey","assetType","contentId","uploadedById","updatedAt") VALUES ('asset','cut.mp4','object','VIDEO','content','u',now());
      INSERT INTO "AssetVersion" (id,version,"storageKey","fileName","assetId") VALUES ('v1',1,'object','cut.mp4','asset');
      INSERT INTO "Review" (id,"contentId","authorId","assetVersionId","updatedAt") VALUES ('review','content','u','v1',now());
      INSERT INTO "ReviewComment" (id,comment,"reviewId","authorId","updatedAt") VALUES ('comment','Fix','review','u',now());
      INSERT INTO "ContentAssignment" (id,"contentId","userId") VALUES ('assignment','content','u');`);
    await assert.rejects(db.exec(`INSERT INTO "AssetVersion" (id,version,"storageKey","fileName","assetId") VALUES ('duplicate-key',2,'object','cut.mp4','asset')`),e=>e.code==='23505');
    await assert.rejects(db.exec(`INSERT INTO "AssetVersion" (id,version,"storageKey","fileName","assetId") VALUES ('duplicate-number',1,'new-object','cut.mp4','asset')`),e=>e.code==='23505');
    await assert.rejects(db.exec(`INSERT INTO "AssetVersion" (id,version,"storageKey","fileName","assetId") VALUES ('zero',0,'zero-object','cut.mp4','asset')`),e=>e.code==='23514');
    await assert.rejects(db.exec(`INSERT INTO "Review" (id,"contentId","authorId","updatedAt") VALUES ('duplicate-pending','content','u',now())`),e=>e.code==='23505');
    await db.exec(`INSERT INTO "Review" (id,status,"contentId","authorId","updatedAt") VALUES ('history','REVISION_REQUESTED','content','u',now())`);
    await assert.rejects(db.exec(`INSERT INTO "ContentAssignment" (id,"contentId","userId") VALUES ('duplicate-assignment','content','u')`),e=>e.code==='23505');
    await assert.rejects(db.exec(`INSERT INTO "ContentAssignment" (id,"contentId","userId") VALUES ('foreign','missing','u')`),e=>e.code==='23503');
    await db.exec(`DELETE FROM "ContentItem" WHERE id='content'`);
    for (const table of ['Asset','AssetVersion','Review','ReviewComment','ContentAssignment']) assert.equal((await db.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count,0);
  } finally {await db.close();}
});
