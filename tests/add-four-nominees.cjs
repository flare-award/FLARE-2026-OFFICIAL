// Isolated PostgreSQL test. Never connects to production.
const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=s=>{const c=vm.createContext({});vm.runInContext(s+';globalThis.catalog=nominations;globalThis.members=MEMBERS',c);return {catalog:JSON.parse(JSON.stringify(c.catalog)),members:JSON.parse(JSON.stringify(c.members))}};
const after=read(fs.readFileSync('data.js','utf8')),migration=fs.readFileSync('supabase/migrations/20261108_add_four_nominees.sql','utf8');
const expected=new Map([['multigaming-dony-zq',['multigaming','Dony_zq','person','Dony_zq']],['conflict-5',['conflict-of-year','Awal vs Izumrudik','video',null]],['person-8-flourin',['scam-of-year','Flourin','person','Flourin']],['clip-7',['clip-of-year','Izumrudik взорвал дом Awal','video',null]]]);
// Seed existing rows by excluding the new IDs, including live-edited video metadata.
(async()=>{const db=new PGlite();try{
 await db.exec(`create table flare_members(nickname text primary key);create table flare_nominations(id text primary key);create table flare_options(id text primary key,nomination_id text references flare_nominations,name text,kind text,person_nickname text references flare_members,video_url text);create table flare_votes(account_id integer,nomination_id text,option_id text references flare_options,primary key(account_id,nomination_id));`);
 for(const name of after.members)await db.query('insert into flare_members values($1)',[name]);
 for(const n of after.catalog){await db.query('insert into flare_nominations values($1)',[n.id]);for(const i of n.nominees){if(expected.has(i.id))continue;await db.query('insert into flare_options values($1,$2,$3,$4,$5,$6)',[i.id,n.id,i.name,i.type,i.type==='person'&&after.members.includes(i.name)?i.name:null,i.type==='video'?'https://example.test/'+i.id:null])}}
 await db.exec("update flare_options set name='Сохранённое название видео' where id='clip-1';insert into flare_votes values(1,'multigaming','person-2-dony-zq'),(2,'scam-of-year','person-8-akirakume');");
 const old=(await db.query('select * from flare_options order by id')).rows,votes=(await db.query('select * from flare_votes order by account_id')).rows;
 await db.exec(migration);
 const current=(await db.query('select * from flare_options order by id')).rows;assert.equal(current.length,old.length+4);
 for(const row of old)assert.deepStrictEqual(current.find(x=>x.id===row.id),row);
 for(const [id,[nom,name,kind,nick]] of expected){const row=current.find(x=>x.id===id);assert.deepStrictEqual([row.nomination_id,row.name,row.kind,row.person_nickname],[nom,name,kind,nick]);assert.equal(row.video_url,null);const item=after.catalog.find(n=>n.id===nom).nominees.find(i=>i.id===id);assert.equal(item.name,name);assert.equal(item.type,kind)}
 assert.deepStrictEqual((await db.query('select * from flare_votes order by account_id')).rows,votes);
 assert.equal(current.find(x=>x.id==='person-2-dony-zq').name,'Nodben');assert.equal(current.find(x=>x.name==='Liwersi').person_nickname,null);
 await db.exec(migration);assert.deepStrictEqual((await db.query('select * from flare_options order by id')).rows,current);
 assert.equal((await db.query("select count(*)::integer as n from flare_members where nickname='Liwersi'")).rows[0].n,0);
 console.log('PASS four matching frontend/backend additions, existing IDs/votes/video edits preserved, accountless Liwersi, migration idempotent');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
