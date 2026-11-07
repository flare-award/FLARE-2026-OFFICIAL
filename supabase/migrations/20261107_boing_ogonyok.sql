-- Daily Ogonyok: Moscow calendar days, completed fair rounds only. No backfill.
begin;
alter table public.flare_boing_profiles
 add column if not exists streak_days integer not null default 0,
 add column if not exists streak_best integer not null default 0,
 add column if not exists streak_day date,
 add column if not exists daily_day date,
 add column if not exists daily_score bigint not null default 0,
 add column if not exists run_streak_bonus integer not null default 0;
create or replace function public.flare_boing_day() returns date
language sql stable set search_path=pg_catalog as $$ select (statement_timestamp() at time zone 'Europe/Moscow')::date $$;
create or replace function public.flare_boing_streak_bonus(p_days integer) returns integer
language sql immutable strict set search_path=pg_catalog as $$
 select case when p_days>=20 then 12+3*((p_days-20)/10) when p_days>=15 then 9 when p_days>=10 then 6 when p_days>=5 then 3 when p_days>=1 then 1 else 0 end $$;
create or replace function public.flare_boing_streak_days(p_account uuid) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 select case when streak_day>=public.flare_boing_day()-1 then streak_days else 0 end from public.flare_boing_profiles where account_id=p_account $$;
create or replace function public.flare_boing_streak_state(p_account uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('days',public.flare_boing_streak_days(p_account),'best',streak_best,
 'bonus',public.flare_boing_streak_bonus(public.flare_boing_streak_days(p_account)),
 'today_score',case when daily_day=public.flare_boing_day() then daily_score else 0 end,
 'qualified_today',coalesce(streak_day=public.flare_boing_day(),false),'goal',1000,'timezone','Europe/Moscow','day',public.flare_boing_day())
 from public.flare_boing_profiles where account_id=p_account $$;
create or replace function public.flare_boing_credit_day(p_account uuid,p_score bigint) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.flare_boing_profiles%rowtype; today date:=public.flare_boing_day(); points bigint; days integer;
begin
 if p_score<=0 then return; end if;
 select * into p from public.flare_boing_profiles where account_id=p_account for update;
 points:=case when p.daily_day=today then p.daily_score else 0 end+p_score;
 days:=p.streak_days;
 if points>=1000 and p.streak_day is distinct from today then
   days:=case when p.streak_day=today-1 then p.streak_days+1 else 1 end;
   update public.flare_boing_profiles set streak_day=today,streak_days=days,streak_best=greatest(streak_best,days) where account_id=p_account;
 end if;
 update public.flare_boing_profiles set daily_day=today,daily_score=points where account_id=p_account;
end $$;
revoke all on function public.flare_boing_day(),public.flare_boing_streak_bonus(integer),public.flare_boing_streak_days(uuid),public.flare_boing_streak_state(uuid),public.flare_boing_credit_day(uuid,bigint) from public,anon,authenticated;
-- Retired item remains as a historical inventory record, but is not sold or required.
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
    from public.flare_boing_items i where i.id<>'leader-bob-name'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'kind',kind,'name',name,'description',description,'level',level,'max_level',max_level,
    'owned',level>0,'sold_out',level>=max_level,'price',case when kind in ('click','coin') then public.flare_boing_upgrade_price(base_price,level) else base_price end
  ) order by sort_order,id),'[]'::jsonb) into v_shop from levels;
  return jsonb_build_object(
    'economy_version',3,'streak_version',1,'streak',public.flare_boing_streak_state(p_account),
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
    'points_per_click',1+v_profile.click_level+case when v_profile.run_id is not null then v_profile.run_streak_bonus else public.flare_boing_streak_bonus(public.flare_boing_streak_days(p_account)) end,
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
  update public.flare_boing_profiles set run_id=v_run,run_streak_bonus=public.flare_boing_streak_bonus(public.flare_boing_streak_days(v_account)),run_score=0,run_clicks=0,run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]'::jsonb,run_started_at=now(),games_played=games_played+1,updated_at=now() where account_id=v_account;
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
 v_pending:=v_profile.run_pending_score+v_delta*(1+v_profile.click_level+v_profile.run_streak_bonus);
 v_run_score:=v_profile.run_score+v_delta*(1+v_profile.click_level+v_profile.run_streak_bonus);
 if coalesce(p_failed,false) then
   v_reward:=public.flare_boing_round_reward(v_run_score,v_profile.coin_level)-public.flare_boing_round_reward(v_profile.run_reward_base_score,v_profile.coin_level);
   update public.flare_boing_profiles set
     best_score=greatest(best_score,v_run_score),total_score=total_score+v_pending,
     total_clicks=total_clicks+p_clicks-v_profile.run_base_clicks,coins=coins+v_reward,coins_earned=coins_earned+v_reward,
     run_id=null,run_score=0,run_clicks=0,run_started_at=null,run_base_clicks=0,run_reward_base_score=0,run_pending_score=0,run_input_times='[]'::jsonb,
     last_run_id=p_run_id,last_run_rejected=false,last_run_score=v_run_score,last_run_reward=v_reward,updated_at=now()
   where account_id=v_account;
   perform public.flare_boing_credit_day(v_account,v_pending);
   if v_run_score>=10000 then perform public.flare_grant_boing_badge(v_account,'boing-10k'); end if;
   if v_run_score>=100000 then perform public.flare_grant_boing_badge(v_account,'boing-100k'); end if;
 else
   update public.flare_boing_profiles set run_score=v_run_score,run_clicks=p_clicks,run_pending_score=v_pending,run_input_times=v_times,updated_at=now() where account_id=v_account;
 end if;
 return jsonb_build_object('ok',true,'rejected',false,'failed',coalesce(p_failed,false),'run_score',v_run_score,'reward',v_reward,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.buy_boing_item(p_token text,p_item_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_profile public.flare_boing_profiles%rowtype;
  v_item public.flare_boing_items%rowtype;
  v_level integer;
  v_price bigint;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  select * into v_profile from public.flare_boing_profiles where account_id=v_account for update;
  if p_item_id='leader-bob-name' then raise exception 'Имя BOB теперь видно всем бесплатно.'; end if;
  select * into v_item from public.flare_boing_items where id=p_item_id;
  if not found then raise exception 'Товар не найден.'; end if;
  v_level:=case when v_item.kind='click' then v_profile.click_level when v_item.kind='coin' then v_profile.coin_level when exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id=v_item.id) then 1 else 0 end;
  if v_level>=v_item.max_level then raise exception 'Этот товар уже куплен или улучшен до максимума.'; end if;
  v_price:=case when v_item.kind in ('click','coin') then public.flare_boing_upgrade_price(v_item.base_price,v_level) else v_item.base_price end;
  if v_profile.coins<v_price then raise exception 'Не хватает COINS: нужно %.',v_price; end if;
  update public.flare_boing_profiles set
    coins=coins-v_price,
    click_level=case when v_item.kind='click' then click_level+1 else click_level end,
    coin_level=case when v_item.kind='coin' then coin_level+1 else coin_level end,
    selected_frame=case when v_item.kind='frame' then v_item.id else selected_frame end,
    selected_accessory=case when v_item.kind='accessory' then v_item.id else selected_accessory end,
    updated_at=now()
  where account_id=v_account;
  if v_item.kind not in ('click','coin') then
    insert into public.flare_boing_inventory(account_id,item_id) values(v_account,v_item.id) on conflict(account_id,item_id) do nothing;
  end if;
  if v_item.kind='badge' then perform public.flare_grant_boing_badge(v_account,v_item.id); end if;
  return jsonb_build_object('ok',true,'spent',v_price,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.get_boing_leaders(p_token text,p_sort text default 'score')
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_leaders jsonb;
begin
  perform public.flare_assert_account_access(v_account);
  if p_sort not in ('score','coins') then raise exception 'Неизвестная сортировка.'; end if;
  with players as (
    select a.nickname,
      p.bob_name,public.flare_boing_streak_state(p.account_id) as streak,
      p.best_score,p.coins,p.total_clicks
    from public.flare_boing_profiles p join public.flare_accounts a on a.id=p.account_id
    where p.total_clicks>0 and not a.is_test_account
  ), ranked as (
    select *,row_number() over(
      order by case when p_sort='coins' then coins else best_score end desc,
        case when p_sort='coins' then best_score else coins end desc,nickname
    ) as rank from players
  ), limited as (select * from ranked order by rank limit 50)
  select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'nickname',nickname,'bob_name',bob_name,'streak',streak,'best_score',best_score,'coins',coins,'total_clicks',total_clicks) order by rank),'[]'::jsonb)
  into v_leaders from limited;
  return jsonb_build_object('sort',p_sort,'leaders',v_leaders);
end $$;

create or replace function public.get_public_flare_profile(p_token text,p_nickname text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_viewer uuid:=public.flare_session_account(p_token);
  v_account uuid;
  v_created timestamptz;
  v_profile public.flare_boing_profiles%rowtype;
  v_badges jsonb;
  v_votes integer;
  v_total integer;
  v_banner text;
  v_face text;
begin
  perform public.flare_assert_account_access(v_viewer);
  select id,created_at into v_account,v_created from public.flare_accounts where nickname=p_nickname and not is_test_account;
  if not found then raise exception 'Профиль участника не найден.'; end if;
  perform public.flare_ensure_boing_profile(v_account);
  select * into v_profile from public.flare_boing_profiles where account_id=v_account;
  select count(*) into v_votes from public.flare_votes where account_id=v_account;
  select count(*) into v_total from public.flare_nominations;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'rarity',b.rarity,'equipped',true) order by b.sort_order,b.id),'[]'::jsonb)
    into v_badges from public.flare_account_badges ab join public.flare_badges b on b.id=ab.badge_id
    where ab.account_id=v_account and ab.equipped;
  if exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id='banner-custom') then
    select 'data:image/jpeg;base64,'||translate(pg_catalog.encode(image_data,'base64'),E'\r\n','') into v_banner from public.flare_profile_banners where account_id=v_account;
  end if;
  if v_profile.face_data is not null then
    v_face:='data:image/png;base64,'||translate(pg_catalog.encode(v_profile.face_data,'base64'),E'\r\n','');
  end if;
  return jsonb_build_object(
    'nickname',p_nickname,
    'created_at',v_created,
    'votes_done',coalesce(v_votes,0),
    'total_nominations',v_total,
    'days_with_flare',greatest(0,floor(extract(epoch from now()-v_created)/86400)::integer),
    'banner',v_banner,
    'boing',jsonb_build_object(
      'streak',public.flare_boing_streak_state(v_account),
      'bob_name',v_profile.bob_name,
      'best_score',v_profile.best_score,
      'coins',v_profile.coins,
      'total_clicks',v_profile.total_clicks,
      'selected_frame',v_profile.selected_frame,
      'selected_accessory',v_profile.selected_accessory,
      'face',v_face,
      'badges',v_badges
    )
  );
end $$;
update public.flare_options set kind='video' where id='event-1';
commit;
