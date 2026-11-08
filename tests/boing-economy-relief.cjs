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

const relief=fs.readFileSync('supabase/migrations/20261108_boing_lower_prices_and_100_point_rewards.sql','utf8');
await db.query("update flare_boing_profiles set coins=123456,coins_earned=654321,best_score=1234 where account_id=$1",[id]);
await db.query("insert into flare_boing_inventory(account_id,item_id) values($1,'bob-cap')",[id]);
const before=(await db.query('select row_to_json(p) r from flare_boing_profiles p')).rows[0].r;
const oldPrices=(await state()).shop;
await db.exec(relief);
assert.deepEqual((await db.query('select row_to_json(p) r from flare_boing_profiles p')).rows[0].r,before);
const current=await state();assert(current.inventory.includes('bob-cap'));assert.equal(current.reward_step_score,100);
for(const item of current.shop){const old=oldPrices.find(i=>i.id===item.id);assert.equal(item.price,Math.floor(old.price*.7));}
for(const score of [0,99,100,101,199,200,299,1000])for(const boost of [0,1,5])assert.equal((await db.query('select flare_boing_round_reward($1,$2) r',[score,boost])).rows[0].r,Math.floor(score/100)*(100+10*boost));
await db.exec(relief);assert.deepEqual((await state()).shop,current.shop);
// Completed fair rounds only; no carry between rounds, retries never double-pay.
for(const n of [99,1,100,199,200]){const run=(await start()).run_id;const pending=await sync(run,n,false);assert.equal(pending.reward,0);const done=await sync(run,n,true);assert.equal(done.reward,Math.floor(n/100)*100);const balance=(await state()).coins;assert.equal((await sync(run,n,true)).reward,0);assert.equal((await state()).coins,balance);}
await db.query('update flare_boing_profiles set coins=1000000 where account_id=$1',[id]);
for(let level=0;level<5;level++){const item=(await state()).shop.find(i=>i.id==='click-power');assert.equal(item.price,3500*(level+1)**2);const result=(await db.query("select buy_boing_item($1,'click-power') r",[id])).rows[0].r;assert.equal(result.spent,item.price);}
const run=(await start()).run_id;await sync(run,100,false);const coins=(await state()).coins;await db.query('select discard_boing_run($1,$2)',[id,run]);assert.equal((await state()).coins,coins);
assert.equal((await db.query("select has_function_privilege('anon','flare_boing_round_reward(bigint,integer)','execute') allowed")).rows[0].allowed,false);
console.log('PASS lower fixed prices/idempotence, quote-charge parity at every upgrade level, balances/history/ownership preserved, 99/100 boundaries/boosts, completed rounds only/no carry, retry/discard/ACL unchanged');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
