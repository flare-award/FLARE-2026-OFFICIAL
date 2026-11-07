// Isolated PostgreSQL regression (PGlite via external NODE_PATH). Never contacts production.
const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('assert');
const integrity=fs.readFileSync('supabase/migrations/20261107_boing_round_rewards_and_integrity.sql','utf8');
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
const id='11111111-1111-4111-8111-111111111111',run='22222222-2222-4222-8222-222222222222';
await db.query('insert into flare_accounts values($1)',[id]);await db.query('select flare_ensure_boing_profile($1)',[id]);
// Upgrade an already partially credited pre-migration round, retaining its past credits.
await db.query(`update flare_boing_profiles set run_id=$1,run_clicks=40,run_score=80,total_clicks=40,total_score=80,best_score=80,click_level=1,coins=123,run_started_at=now()-interval '1 day'`,[run]);
await db.exec(integrity);
await db.exec("create table grant_log(account_id uuid,badge_id text);create or replace function flare_grant_boing_badge(uuid,text) returns void language sql as 'insert into grant_log values($1,$2)'");
async function sync(n,failed=false,times=[]){return (await db.query('select sync_boing_checked_run($1,$2,$3,$4,$5::jsonb) as r',[id,run,n,failed,JSON.stringify(times)])).rows[0].r}
async function state(){return (await db.query('select flare_boing_state($1) as r',[id])).rows[0].r}
const old=await sync(60,true);assert.equal(old.boing.total_clicks,60);assert.equal(old.boing.total_score,120);assert.equal(old.boing.coins,123);
async function reset(level=0){await db.query(`update flare_boing_profiles set run_id=$1,last_run_id=null,run_clicks=0,run_score=0,run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]',total_clicks=0,total_score=0,best_score=0,coins=123,coins_earned=0,click_level=$2,coin_level=0,run_started_at=now()-interval '1 day'`,[run,level])}
await reset(5);let progress=await sync(100);assert.equal(progress.reward,0);assert.equal(progress.boing.coins,123);assert.equal(progress.boing.best_score,0);assert.equal(progress.boing.total_clicks,0);assert.equal(progress.boing.active_run.score,600);
await sync(100);const fair=await sync(101,true);assert.equal(fair.reward,300);assert.equal(fair.boing.coins,423);assert.equal(fair.boing.total_clicks,101);assert.equal(fair.boing.total_score,606);assert.equal(fair.boing.best_score,606);const retry=await sync(101,true);assert(retry.already_settled);assert.equal(retry.reward,0);assert.equal((await state()).coins,423);
await reset();await sync(120);let discard=(await db.query('select discard_boing_run($1,$2) as r',[id,run])).rows[0].r;assert(discard.rejected);assert.equal(discard.boing.coins,123);assert.equal(discard.boing.total_score,0);assert.equal(discard.boing.best_score,0);assert.equal(discard.boing.active_run,null);
await reset();await sync(20000);assert.equal((await db.query('select count(*)::integer as n from grant_log')).rows[0].n,0);await db.query('select discard_boing_run($1,$2)',[id,run]);assert.equal((await db.query('select count(*)::integer as n from grant_log')).rows[0].n,0);
await reset();await sync(10000,true);assert.equal((await db.query("select count(*)::integer as n from grant_log where badge_id='boing-10k'")).rows[0].n,1);await db.exec('truncate grant_log');
const samples=(n,gap,jitter=()=>0)=>Array.from({length:n},(_,i)=>({n:i+1,t:1700000000000+i*gap+jitter(i)}));
const patterns=[samples(63,2),samples(80,120,i=>Math.sin(i)*7),samples(80,60,i=>Math.cos(i)*3),samples(80,100),samples(80,200),samples(80,1000,i=>Math.sin(i)*.1),samples(80,100,i=>i>45?5000:0),samples(64,8),samples(80,80,i=>[-.2,.1,.25,-.05][i%4])];
const vm=require('vm'),ctx=vm.createContext({Set,Math}),js=fs.readFileSync('profile.js','utf8');vm.runInContext(js.slice(js.indexOf('function boingAutomationPattern'),js.indexOf('function acceptBobInput')),ctx);
for(const times of patterns){const server=(await db.query('select flare_boing_automated_times($1::jsonb) as flag',[JSON.stringify(times)])).rows[0].flag;assert.equal(server,ctx.boingAutomationPattern(times))}
await reset();const automatic=samples(64,80,i=>[-.2,.1,.25,-.05][i%4]);assert.equal((await sync(32,false,automatic.slice(0,32))).rejected,false);const detected=await sync(64,false,automatic);assert(detected.rejected);assert.equal(detected.boing.coins,123);assert.equal(detected.boing.best_score,0);assert.equal(detected.boing.total_clicks,0);
await reset();const coarse=await sync(80,true,samples(80,100));assert(!coarse.rejected);assert.equal(coarse.boing.total_clicks,80);
await reset();await sync(100);await db.query("update flare_boing_profiles set run_started_at=now()-interval '1 second'");const fast=await sync(10000,true);assert(fast.rejected);assert.equal(fast.boing.coins,123);assert.equal(fast.boing.total_score,0);
await reset();const newRun=(await db.query('select start_boing_run($1) as r',[id])).rows[0].r.run_id;await db.query('select discard_boing_run($1,$2)',[id,run]);assert.equal((await state()).active_run.id,newRun); // stale cancellation cannot discard a different/new round
await db.exec(integrity);assert.equal((await state()).integrity_version,1);assert.equal((await state()).coins,123);
// Round-local boundaries, no carry-over, no dependency on past score/click totals.
for(const [score,coins] of [[0,0],[100,0],[199,0],[200,100],[201,100],[399,100],[400,200],[450,200],[10000,5000]]){
 await reset();const result=await sync(score,true);assert.equal(result.reward,coins);assert.equal(result.boing.coins,123+coins);
}
await reset();await sync(100,true);await db.query("update flare_boing_profiles set run_id=$1,last_run_id=null,run_clicks=0,run_score=0,run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]',run_started_at=now()-interval '1 day'",[run]);assert.equal((await sync(100,true)).reward,0);assert.equal((await state()).coins,123);assert.equal((await state()).total_score,200);
await reset();await db.exec('update flare_boing_profiles set total_score=1000000,total_clicks=1000000');assert.equal((await sync(199,true)).reward,0);
await reset();for(const n of [100,199,200,399]){const interim=await sync(n);assert.equal(interim.reward,0);assert.equal(interim.boing.coins,123)}assert.equal((await sync(450,true)).reward,200);
for(const level of [0,1,5]){await reset();await db.query('update flare_boing_profiles set coin_level=$1',[level]);assert.equal((await sync(400,true)).reward,2*(100+10*level))}
// POWER CLICK affects real run points, not a client-supplied score.
await reset(5);const powered=await sync(34,true);assert.equal(powered.run_score,204);assert.equal(powered.reward,100);
await reset();await db.query("update flare_boing_profiles set run_score=240,run_clicks=240,run_base_clicks=240,run_reward_base_score=240,total_score=240,total_clicks=240");assert.equal((await sync(400,true)).reward,100); // no duplicate legacy milestone
assert.equal((await state()).reward_basis,'round_score');assert.equal((await state()).economy_version,3);
console.log('PASS round-local rewards (199/200, 399/400, two 100-point rounds, no lifetime carry, batching, boost, POWER CLICK, legacy baseline) and integrity: migration preserves old credits, delayed fair settlement, rejected round gives no coins/score/best/badges, overlap/cadence client-server parity, coarse-clock safety, generous rate guard, stale discard and migration idempotency');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
