-- Round-local score rewards + input integrity. Supersedes the un-applied integrity-only migration.
-- 100 COINS per complete 200 points in THIS round; +10% per boost level.
-- Discard only the current run, never punish or change account access.
-- Credits are provisional until a fair round finishes. Existing credited progress is retained.
begin;
alter table public.flare_boing_profiles
 add column if not exists run_base_clicks bigint,
 add column if not exists run_reward_base_score bigint,
 add column if not exists run_pending_score bigint not null default 0,
 add column if not exists run_input_times jsonb not null default '[]'::jsonb,
 add column if not exists last_run_id uuid,
 add column if not exists last_run_rejected boolean not null default false,
 add column if not exists last_run_score bigint not null default 0,
 add column if not exists last_run_reward bigint not null default 0;
-- A migration in the middle of an old run must not award its already-credited clicks twice.
update public.flare_boing_profiles set run_base_clicks=run_clicks where run_base_clicks is null;
alter table public.flare_boing_profiles alter column run_base_clicks set default 0;
alter table public.flare_boing_profiles alter column run_base_clicks set not null;
update public.flare_boing_profiles set run_reward_base_score=run_score where run_reward_base_score is null;
alter table public.flare_boing_profiles alter column run_reward_base_score set default 0;
alter table public.flare_boing_profiles alter column run_reward_base_score set not null;

create or replace function public.flare_boing_round_reward(p_score bigint,p_level integer)
returns bigint language plpgsql immutable strict set search_path=pg_catalog as $$
begin
 if p_score<0 or p_level<0 or p_level>5 then raise exception 'Invalid BOING round score or boost level.'; end if;
 return (p_score/200)*(100+10*p_level);
end $$;
revoke all on function public.flare_boing_round_reward(bigint,integer) from public,anon,authenticated;
update public.flare_boing_items set description='Больше очков за клик. COINS выдаются за каждые 200 очков одного раунда. Каждый следующий уровень дороже.' where id='click-power';

create or replace function public.flare_boing_automated_times(p_times jsonb)
returns boolean language plpgsql immutable strict set search_path=pg_catalog as $$
declare v_count integer; v_span double precision; v_min double precision; v_max double precision; v_variance double precision; v_fractions integer; v_mean double precision;
begin
 with samples as (
   select (value->>'t')::double precision as t,ordinality as i
   from jsonb_array_elements(p_times) with ordinality order by ordinality desc limit 64
 ), gaps as (select t,t-lag(t) over(order by i) as gap from samples)
 select count(*),max(t)-min(t),min(gap),max(gap),var_pop(gap),count(distinct round((t*10)::numeric)::bigint%10)
 into v_count,v_span,v_min,v_max,v_variance,v_fractions from gaps;
 if v_count<64 or v_min<=0 then return false; end if;
 if v_span<800 then return true; end if;
 v_mean:=v_span/63;
 return v_mean>=12 and v_mean<=220 and v_fractions>=4 and v_max-v_min<1.3 and v_variance<.1225;
end $$;
revoke all on function public.flare_boing_automated_times(jsonb) from public,anon,authenticated;

create or replace function public.discard_boing_run(p_token text,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
 perform public.flare_assert_account_access(v_account);
 update public.flare_boing_profiles set run_id=null,run_score=0,run_clicks=0,run_started_at=null,
 run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]'::jsonb,
 last_run_id=p_run_id,last_run_rejected=true,last_run_score=0,last_run_reward=0,updated_at=now()
 where account_id=v_account and run_id=p_run_id;
 return jsonb_build_object('ok',true,'rejected',true,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.flare_boing_state(p_account uuid)
returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare
  v_profile public.flare_boing_profiles%rowtype;
  v_badges jsonb;
  v_inventory jsonb;
  v_shop jsonb;
begin
  select * into v_profile from public.flare_boing_profiles where account_id=p_account;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'rarity',b.rarity,'equipped',ab.equipped,'earned_at',ab.earned_at) order by b.sort_order,b.id),'[]'::jsonb)
  into v_badges from public.flare_account_badges ab join public.flare_badges b on b.id=ab.badge_id where ab.account_id=p_account;
  select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb) into v_inventory from public.flare_boing_inventory where account_id=p_account;
  with levels as (
    select i.*,
      case
        when i.kind='click' then v_profile.click_level
        when i.kind='coin' then v_profile.coin_level
        when exists(select 1 from public.flare_boing_inventory inv where inv.account_id=p_account and inv.item_id=i.id) then 1
        else 0
      end as level
    from public.flare_boing_items i
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'kind',kind,'name',name,'description',description,'level',level,'max_level',max_level,
    'owned',level>0,'sold_out',level>=max_level,'price',case when kind in ('click','coin') then public.flare_boing_upgrade_price(base_price,level) else base_price end
  ) order by sort_order,id),'[]'::jsonb) into v_shop from levels;
  return jsonb_build_object(
    'economy_version',3,
    'reward_basis','round_score','reward_step_score',200,'reward_step_coins',100,
    'integrity_version',1,
    'bob_name',v_profile.bob_name,
    'bob_rename_count',v_profile.bob_rename_count,
    'free_renames_left',greatest(0,2-v_profile.bob_rename_count),
    'rename_price',case when v_profile.bob_rename_count<2 then 0 else 10000 end,
    'coins',v_profile.coins,
    'coins_earned',v_profile.coins_earned,
    'best_score',v_profile.best_score,
    'total_score',v_profile.total_score,
    'total_clicks',v_profile.total_clicks,
    'games_played',v_profile.games_played,
    'click_level',v_profile.click_level,
    'coin_level',v_profile.coin_level,
    'points_per_click',1+v_profile.click_level,
    'coin_multiplier',1+v_profile.coin_level*.1,
    'selected_frame',v_profile.selected_frame,
    'selected_accessory',v_profile.selected_accessory,
    'game_intro_seen',v_profile.game_intro_seen,
    'active_run',case when v_profile.run_id is null then null else jsonb_build_object('id',v_profile.run_id,'score',v_profile.run_score,'clicks',v_profile.run_clicks) end,
    'inventory',v_inventory,
    'badges',v_badges,
    'shop',v_shop
  );
end $$;

create or replace function public.start_boing_run(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_run uuid:=gen_random_uuid();
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  update public.flare_boing_profiles set run_id=v_run,run_score=0,run_clicks=0,run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]'::jsonb,run_started_at=now(),games_played=games_played+1,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true,'run_id',v_run,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.sync_boing_checked_run(p_token text,p_run_id uuid,p_clicks bigint,p_failed boolean default false,p_times jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
 v_account uuid:=public.flare_session_account(p_token);
 v_profile public.flare_boing_profiles%rowtype;
 v_delta bigint; v_max_clicks bigint; v_run_score bigint; v_pending bigint; v_reward bigint:=0;
 v_times jsonb;
begin
 perform public.flare_assert_account_access(v_account);
 perform public.flare_ensure_boing_profile(v_account);
 if p_clicks is null or p_clicks<0 or p_clicks>1000000000 then raise exception 'Некорректное число кликов.'; end if;
 select * into v_profile from public.flare_boing_profiles where account_id=v_account for update;
 -- A lost response must be safe to retry: never pay twice or trap an honest player.
 if v_profile.last_run_id=p_run_id then
   return jsonb_build_object('ok',true,'already_settled',true,'rejected',v_profile.last_run_rejected,'failed',true,'run_score',v_profile.last_run_score,'reward',0,'boing',public.flare_boing_state(v_account));
 end if;
 if v_profile.run_id is null or v_profile.run_id<>p_run_id then raise exception 'Этот раунд уже завершён.'; end if;
 v_delta:=p_clicks-v_profile.run_clicks;
 if v_delta<0 then raise exception 'Некорректное обновление раунда.'; end if;
 -- Large burst allowance + generous sustained rate; network batching is not a reason to fail.
 v_max_clicks:=floor(greatest(0,extract(epoch from now()-v_profile.run_started_at))*40)::bigint+64;
 if p_clicks>v_max_clicks then return public.discard_boing_run(p_token,p_run_id); end if;
 if jsonb_typeof(p_times) is distinct from 'array' or jsonb_array_length(p_times)>80 then raise exception 'Некорректные данные нажатий.'; end if;
 -- Retain overlapping batches only once, keyed by click number. Never trust a supplied score.
 with incoming as (
   select value from jsonb_array_elements(p_times)
   where jsonb_typeof(value)='object' and jsonb_typeof(value->'n')='number' and jsonb_typeof(value->'t')='number'
 ), valid as (
   select (value->>'n')::numeric as n,(value->>'t')::numeric as t from incoming
 ), merged as (
   select (value->>'n')::bigint as n,(value->>'t')::double precision as t from jsonb_array_elements(v_profile.run_input_times)
   union all
   select n::bigint,t::double precision from valid where n>v_profile.run_clicks and n<=p_clicks and n=trunc(n) and t>=0 and t<1e16
 ), unique_samples as (select distinct on(n) n,t from merged order by n,t), recent as (select * from unique_samples order by n desc limit 80)
 select coalesce(jsonb_agg(jsonb_build_object('n',n,'t',t) order by n),'[]'::jsonb) into v_times from recent;
 if public.flare_boing_automated_times(v_times) then return public.discard_boing_run(p_token,p_run_id); end if;
 v_pending:=v_profile.run_pending_score+v_delta*(1+v_profile.click_level);
 v_run_score:=v_profile.run_score+v_delta*(1+v_profile.click_level);
 if coalesce(p_failed,false) then
   v_reward:=public.flare_boing_round_reward(v_run_score,v_profile.coin_level)-public.flare_boing_round_reward(v_profile.run_reward_base_score,v_profile.coin_level);
   update public.flare_boing_profiles set
     best_score=greatest(best_score,v_run_score),total_score=total_score+v_pending,
     total_clicks=total_clicks+p_clicks-v_profile.run_base_clicks,coins=coins+v_reward,coins_earned=coins_earned+v_reward,
     run_id=null,run_score=0,run_clicks=0,run_started_at=null,run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]'::jsonb,
     last_run_id=p_run_id,last_run_rejected=false,last_run_score=v_run_score,last_run_reward=v_reward,updated_at=now()
   where account_id=v_account;
   if v_run_score>=10000 then perform public.flare_grant_boing_badge(v_account,'boing-10k'); end if;
   if v_run_score>=100000 then perform public.flare_grant_boing_badge(v_account,'boing-100k'); end if;
 else
   update public.flare_boing_profiles set run_score=v_run_score,run_clicks=p_clicks,run_pending_score=v_pending,run_input_times=v_times,updated_at=now() where account_id=v_account;
 end if;
 return jsonb_build_object('ok',true,'rejected',false,'failed',coalesce(p_failed,false),'run_score',v_run_score,'reward',v_reward,'boing',public.flare_boing_state(v_account));
end $$;

-- Old clients retain normal play; the server-side rate guard and delayed settlement still apply.
create or replace function public.sync_boing_run(p_token text,p_run_id uuid,p_clicks bigint,p_failed boolean default false)
returns jsonb language sql security definer set search_path=public,extensions,pg_temp as $$
 select public.sync_boing_checked_run(p_token,p_run_id,p_clicks,p_failed,'[]'::jsonb);
$$;
revoke all on function public.discard_boing_run(text,uuid) from public,authenticated;
revoke all on function public.sync_boing_checked_run(text,uuid,bigint,boolean,jsonb) from public,authenticated;
grant execute on function public.discard_boing_run(text,uuid) to anon;
grant execute on function public.sync_boing_checked_run(text,uuid,bigint,boolean,jsonb) to anon;
commit;
