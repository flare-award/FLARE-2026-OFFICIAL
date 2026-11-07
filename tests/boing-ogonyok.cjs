// Isolated real PostgreSQL tests. No production requests.
const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('assert');
const schema=fs.readFileSync('supabase/schema.sql','utf8'),migration=fs.readFileSync('supabase/migrations/20261107_boing_economy_v2.sql','utf8');
const table=name=>schema.match(new RegExp('create table if not exists public\\.'+name+' \\([\\s\\S]*?\\n\\);'))[0];
(async()=>{const db=new PGlite();try{
await db.exec(`create schema extensions;create role anon;create role authenticated;create table flare_accounts(id uuid primary key);
${table('flare_boing_profiles')}
${table('flare_boing_items').replace("'banner','badge'","'banner','badge','face','leader'")}
${table('flare_boing_inventory')}
${table('flare_badges')}
${table('flare_account_badges')}
create function flare_session_account(text) returns uuid language sql as 'select $1::uuid';
create function flare_assert_account_access(uuid) returns void language plpgsql as $$ begin if not exists(select 1 from flare_accounts where id=$1) then raise exception 'No account'; end if; end $$;
create function flare_ensure_boing_profile(uuid) returns void language sql as 'insert into flare_boing_profiles(account_id) values($1) on conflict do nothing';
create function flare_grant_boing_badge(uuid,text) returns void language plpgsql as $$ begin return; end $$;`);
await db.exec(migration);

await db.exec(fs.readFileSync('supabase/migrations/20261107_boing_round_rewards_and_integrity.sql','utf8'));
await db.exec(`alter table flare_accounts add column nickname text,add column is_test_account boolean default false;
create table flare_options(id text primary key,kind text);insert into flare_options values('event-1','image');`);
const fire=fs.readFileSync('supabase/migrations/20261107_boing_ogonyok.sql','utf8');await db.exec(fire);
await db.exec(`create table test_clock(day date);insert into test_clock values('2026-01-01');
create or replace function flare_boing_day() returns date language sql stable as 'select day from test_clock';`);
const id='11111111-1111-4111-8111-111111111111';
await db.query("insert into flare_accounts(id,nickname) values($1,'Player')",[id]);await db.query('select flare_ensure_boing_profile($1)',[id]);
async function state(){return (await db.query('select flare_boing_state($1) r',[id])).rows[0].r}
async function day(n){await db.query("update test_clock set day='2026-01-01'::date+$1::integer",[n-1])}
async function start(){return (await db.query('select start_boing_run($1) r',[id])).rows[0].r}
async function sync(run,n,final=true,times=[]){await db.query("update flare_boing_profiles set run_started_at=now()-interval '1 day' where account_id=$1",[id]);return (await db.query('select sync_boing_checked_run($1,$2,$3,$4,$5::jsonb) r',[id,run,n,final,JSON.stringify(times)])).rows[0].r}
assert.equal((await state()).streak.days,0);assert.equal((await state()).points_per_click,1);
let r=await start();await sync(r.run_id,500);assert.equal((await state()).streak.days,0);assert.equal((await state()).streak.today_score,500);
r=await start();await sync(r.run_id,500,false);assert.equal((await state()).streak.today_score,500);await sync(r.run_id,500);assert.equal((await state()).streak.days,1);assert.equal((await state()).points_per_click,2);
r=await start();await sync(r.run_id,10);assert.equal((await state()).streak.days,1);assert.equal((await state()).streak.today_score,1020);
const bonus=d=>d>=20?12+3*Math.floor((d-20)/10):d>=15?9:d>=10?6:d>=5?3:d>=1?1:0;
for(let d=2;d<=60;d++){
 await day(d);const before=await state();assert.equal(before.streak.days,d-1);assert.equal(before.streak.today_score,0);
 r=await start();assert.equal(r.boing.points_per_click,1+bonus(d-1));const settled=await sync(r.run_id,1000);
 assert.equal(settled.run_score,1000*(1+bonus(d-1)));assert.equal(settled.reward,Math.floor(settled.run_score/200)*100);
 assert.equal(settled.boing.streak.days,d);assert.equal(settled.boing.streak.best,d);assert.equal(settled.boing.points_per_click,1+bonus(d));
 const retry=await sync(r.run_id,1000);assert(retry.already_settled);assert.equal(retry.boing.streak.days,d);
}
// One grace day: yesterday's streak remains active while today's goal is unfinished.
await day(61);assert.equal((await state()).streak.days,60);await day(62);assert.equal((await state()).streak.days,0);assert.equal((await state()).streak.best,60);assert.equal((await state()).points_per_click,1);
r=await start();await sync(r.run_id,999);assert.equal((await state()).streak.days,0);r=await start();await sync(r.run_id,1);assert.equal((await state()).streak.days,1);assert.equal((await state()).streak.best,60);
// Midnight: round bonus stays snapshotted, score belongs to the completion day.
r=await start();await day(64);assert.equal((await state()).points_per_click,2);const midnight=await sync(r.run_id,500);assert.equal(midnight.run_score,1000);assert.equal(midnight.boing.streak.days,1);assert.equal(midnight.boing.streak.today_score,1000);
// Rejection: no day score, no new streak, no achievements or credits.
await day(65);r=await start();const before=await state();const samples=Array.from({length:64},(_,i)=>({n:i+1,t:1700000000000+i*80+[-.2,.1,.25,-.05][i%4]}));const rejected=await sync(r.run_id,64,true,samples);assert(rejected.rejected);assert.equal(rejected.boing.streak.today_score,0);assert.equal(rejected.boing.coins,before.coins);assert.equal(rejected.boing.streak.best,60);
assert(!(await state()).shop.some(i=>i.id==='leader-bob-name'));
await assert.rejects(db.query("select buy_boing_item($1,'leader-bob-name')",[id]),/бесплатно/);
const leaders=(await db.query("select get_boing_leaders($1,'score') r",[id])).rows[0].r.leaders;assert.equal(leaders[0].bob_name,'BOB');assert.equal(leaders[0].streak.best,60);
assert.equal((await db.query("select kind from flare_options where id='event-1'")).rows[0].kind,'video');
assert.equal((await db.query("select has_function_privilege('anon','flare_boing_credit_day(uuid,bigint)','execute') p")).rows[0].p,false);
await db.exec(fire);assert.equal((await state()).streak.best,60);
console.log('PASS Ogonyok: 1000 daily points, 60-day progression, Moscow day clock, no same-day double award, no provisional/rejected credit, missed-day reset, lifetime best, midnight snapshot, final retry, free leaderboard names, hidden/blocked retired purchase, nominee ID retained, private helpers, reapply preserves data');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
