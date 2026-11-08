// Isolated PostgreSQL regression (PGlite via external NODE_PATH). Never contacts production.
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
const id='11111111-1111-4111-8111-111111111111',run='22222222-2222-4222-8222-222222222222';
await db.query('insert into flare_accounts values($1)',[id]);await db.query('select flare_ensure_boing_profile($1)',[id]);
async function reset(clickLevel=0,coinLevel=0,total=0){await db.query(`update flare_boing_profiles set coins=0,coins_earned=0,total_clicks=$1,total_score=0,click_level=$2,coin_level=$3,run_clicks=0,run_score=0,run_id=$4,run_started_at=now()-interval '1 day' where account_id=$5`,[total,clickLevel,coinLevel,run,id])}
async function sync(clicks,failed=false){return (await db.query('select sync_boing_run($1,$2,$3,$4) as result',[id,run,clicks,failed])).rows[0].result}
for(const level of [0,1,5]){await reset(level);assert.equal((await sync(10)).reward,0);assert.equal((await sync(99)).reward,0);const at100=await sync(100);assert.equal(at100.reward,100);assert.equal(at100.boing.total_clicks,100);assert.equal(at100.boing.total_score,100*(1+level));assert.equal((await sync(100)).reward,0)}
await reset(5,0,9900);assert.equal((await sync(99)).reward,0);assert.equal((await sync(100)).reward,200);assert.equal((await sync(200)).reward,200);
for(const boost of [0,1,5]){await reset(5,boost);const result=await sync(100);assert.equal(result.reward,100+boost*10);assert.equal(result.boing.coin_multiplier,1+boost*.1)}
await reset(0,0);const batched=(await sync(10200)).reward;await reset(0,0);let separate=0;for(const n of [10,100,125,9999,10000,10001,10100,10200])separate+=(await sync(n)).reward;assert.equal(batched,separate);assert.equal(batched,99*100+3*200);
await reset();await sync(60,true);await db.query(`update flare_boing_profiles set run_id=$1,run_clicks=0,run_score=0,run_started_at=now()-interval '1 day'`,[run]);assert.equal((await sync(40)).reward,100);
await reset();await assert.rejects(db.query('select sync_boing_run($1,$2,10000000,false)',[id,run]),/слишком быстро/);
await db.query('update flare_boing_profiles set coins=1000000,run_id=null,click_level=0 where account_id=$1',[id]);
for(let level=0;level<5;level++){const state=(await db.query('select flare_boing_state($1) as s',[id])).rows[0].s,item=state.shop.find(x=>x.id==='click-power');assert.equal(item.price,5000*(level+1)**2);const bought=(await db.query("select buy_boing_item($1,'click-power') as r",[id])).rows[0].r;assert.equal(bought.spent,item.price);assert.equal(bought.boing.click_level,level+1)}
await assert.rejects(db.query("select buy_boing_item($1,'click-power')",[id]),/максимума/);
await db.query('update flare_boing_profiles set coins=0 where account_id=$1',[id]);await assert.rejects(db.query("select buy_boing_item($1,'coin-boost')",[id]),/Не хватает/);assert.equal((await db.query('select coin_level from flare_boing_profiles')).rows[0].coin_level,0);
await db.query('update flare_boing_profiles set coins=100000 where account_id=$1',[id]);const bought=(await db.query("select buy_boing_item($1,'bob-sneakers') as r",[id])).rows[0].r;assert.equal(bought.spent,20000);assert.equal(bought.boing.selected_accessory,'bob-sneakers');assert(bought.boing.inventory.includes('bob-sneakers'));
await db.exec(migration);const preserved=(await db.query('select flare_boing_state($1) as s',[id])).rows[0].s;assert.equal(preserved.coins,80000);assert.equal(preserved.click_level,5);assert(preserved.inventory.includes('bob-sneakers'));assert.equal(preserved.economy_version,2);
console.log('PASS PostgreSQL: click-not-score rewards, 99/100 and 9999/10000 boundaries, +10% levels, sync idempotency/batching/rounds, rate guard, quadratic quote/charge parity, MAX/insufficient funds, new cosmetics and migration preserves balances/ownership');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
