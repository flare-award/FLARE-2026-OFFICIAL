-- FLARE profiles and BOING! — server-owned progress, purchases and badges.
-- Run after the existing FLARE schema. Safe to re-run.
begin;

create table if not exists public.flare_boing_profiles (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  bob_name text not null default 'BOB',
  bob_rename_count integer not null default 0 check (bob_rename_count >= 0),
  coins bigint not null default 0 check (coins >= 0),
  coins_earned bigint not null default 0 check (coins_earned >= 0),
  best_score bigint not null default 0 check (best_score >= 0),
  total_score bigint not null default 0 check (total_score >= 0),
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  click_level integer not null default 0 check (click_level between 0 and 5),
  coin_level integer not null default 0 check (coin_level between 0 and 5),
  selected_frame text not null default 'frame-default',
  selected_accessory text not null default 'accessory-none',
  game_intro_seen boolean not null default false,
  run_id uuid,
  run_score bigint not null default 0 check (run_score >= 0),
  run_clicks bigint not null default 0 check (run_clicks >= 0),
  run_started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.flare_boing_items (
  id text primary key,
  kind text not null check (kind in ('click','coin','frame','accessory','banner','badge')),
  name text not null,
  description text not null,
  base_price bigint not null check (base_price >= 0),
  max_level integer not null default 1 check (max_level > 0),
  sort_order integer not null default 0
);

create table if not exists public.flare_boing_inventory (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  item_id text not null references public.flare_boing_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (account_id,item_id)
);

create table if not exists public.flare_badges (
  id text primary key,
  name text not null,
  description text not null,
  rarity text not null check (rarity in ('special','rare','legendary')),
  sort_order integer not null default 0
);

create table if not exists public.flare_account_badges (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  badge_id text not null references public.flare_badges(id) on delete cascade,
  equipped boolean not null default true,
  earned_at timestamptz not null default now(),
  primary key (account_id,badge_id)
);

create table if not exists public.flare_profile_banners (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  image_data bytea not null,
  updated_at timestamptz not null default now()
);

revoke all on public.flare_boing_profiles,public.flare_boing_items,public.flare_boing_inventory,public.flare_badges,public.flare_account_badges,public.flare_profile_banners from anon,authenticated;
alter table public.flare_boing_profiles enable row level security;
alter table public.flare_boing_items enable row level security;
alter table public.flare_boing_inventory enable row level security;
alter table public.flare_badges enable row level security;
alter table public.flare_account_badges enable row level security;
alter table public.flare_profile_banners enable row level security;

insert into public.flare_boing_items(id,kind,name,description,base_price,max_level,sort_order) values
('click-power','click','POWER CLICK','Больше очков за каждый клик. Всего 5 уровней.',500,5,10),
('coin-boost','coin','COIN BOOST','На 20% больше COINS за каждую цель за уровень.',1500,5,20),
('banner-custom','banner','PHOTO BANNER','Загрузка фотографии для обложки профиля.',7500,1,30),
('frame-gold','frame','GOLD FRAME','Золотая рамка вокруг аватара.',2500,1,40),
('frame-aurora','frame','AURORA FRAME','Переливающаяся рамка вокруг аватара.',12000,1,50),
('frame-inferno','frame','INFERNO FRAME','Огненная рамка вокруг аватара.',25000,1,60),
('bob-shades','accessory','BOB SHADES','Минималистичные тёмные очки для BOB.',1500,1,70),
('bob-cap','accessory','BOB CAP','Маленькая кепка для BOB.',3500,1,80),
('bob-crown','accessory','BOB CROWN','Корона для настоящего чемпиона.',8000,1,90),
('legend','badge','LEGEND BADGE','Очень редкий бейдж для профиля.',1000000,1,100)
on conflict(id) do update set kind=excluded.kind,name=excluded.name,description=excluded.description,base_price=excluded.base_price,max_level=excluded.max_level,sort_order=excluded.sort_order;

insert into public.flare_badges(id,name,description,rarity,sort_order) values
('tester','TESTER','За помощь в тестировании FLARE.','special',10),
('creator','CREATOR','Создатель премии FLARE.','special',20),
('boing-10k','BOING 10K','Рекорд BOING! — не меньше 10 000 очков.','rare',30),
('boing-100k','BOING 100K','Рекорд BOING! — не меньше 100 000 очков.','legendary',40),
('legend','LEGEND','Легендарный бейдж из магазина BOING!.','legendary',50)
on conflict(id) do update set name=excluded.name,description=excluded.description,rarity=excluded.rarity,sort_order=excluded.sort_order;

create or replace function public.flare_ensure_boing_profile(p_account uuid)
returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  insert into public.flare_boing_profiles(account_id) values(p_account) on conflict(account_id) do nothing;
  insert into public.flare_account_badges(account_id,badge_id,equipped)
  select a.id,b.id,true from public.flare_accounts a
  join public.flare_badges b on (a.nickname='Eozik' and b.id='tester') or (a.nickname='Maronnix' and b.id='creator')
  where a.id=p_account on conflict(account_id,badge_id) do nothing;
end $$;

create or replace function public.flare_grant_boing_badge(p_account uuid,p_badge text)
returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  insert into public.flare_account_badges(account_id,badge_id,equipped)
  values(p_account,p_badge,true) on conflict(account_id,badge_id) do nothing;
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
    'owned',level>0,'sold_out',level>=max_level,'price',case when kind in ('click','coin') then base_price*(level+1) else base_price end
  ) order by sort_order,id),'[]'::jsonb) into v_shop from levels;
  return jsonb_build_object(
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
    'coin_multiplier',1+v_profile.coin_level*.2,
    'selected_frame',v_profile.selected_frame,
    'selected_accessory',v_profile.selected_accessory,
    'game_intro_seen',v_profile.game_intro_seen,
    'active_run',case when v_profile.run_id is null then null else jsonb_build_object('id',v_profile.run_id,'score',v_profile.run_score,'clicks',v_profile.run_clicks) end,
    'inventory',v_inventory,
    'badges',v_badges,
    'shop',v_shop
  );
end $$;

create or replace function public.get_my_profile(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_nickname text;
  v_created timestamptz;
  v_is_test boolean;
  v_email text;
  v_votes integer;
  v_total integer;
  v_event_answered boolean:=false;
  v_banner text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  select nickname,created_at,is_test_account into v_nickname,v_created,v_is_test from public.flare_accounts where id=v_account;
  select email into v_email from public.flare_authorized_emails where account_id=v_account order by created_at,email limit 1;
  select count(*) into v_total from public.flare_nominations;
  if v_is_test then
    select count(*) into v_votes from public.flare_test_votes where account_id=v_account;
    select exists(select 1 from public.flare_test_event_choices where account_id=v_account) into v_event_answered;
  else
    select count(*) into v_votes from public.flare_votes where account_id=v_account;
    select exists(select 1 from public.flare_event_choices where account_id=v_account) into v_event_answered;
  end if;
  if exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id='banner-custom') then
    select 'data:image/jpeg;base64,'||translate(pg_catalog.encode(image_data,'base64'),E'\r\n','') into v_banner from public.flare_profile_banners where account_id=v_account;
  end if;
  return jsonb_build_object(
    'nickname',v_nickname,
    'created_at',v_created,
    'email_masked',case when v_email is null then 'Email не привязан' else left(split_part(v_email,'@',1),1)||'•••••@'||split_part(v_email,'@',2) end,
    'votes_done',coalesce(v_votes,0),
    'total_nominations',v_total,
    'event_answered',v_event_answered,
    'days_with_flare',greatest(0,floor(extract(epoch from now()-v_created)/86400)::integer),
    'banner',v_banner,
    'boing',public.flare_boing_state(v_account)
  );
end $$;

create or replace function public.reveal_my_email(p_token text)
returns text language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_email text;
begin
  perform public.flare_assert_account_access(v_account);
  select email into v_email from public.flare_authorized_emails where account_id=v_account order by created_at,email limit 1;
  if v_email is null then raise exception 'К аккаунту не привязан email.'; end if;
  return v_email;
end $$;

create or replace function public.set_my_profile_banner(p_token text,p_data text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_data bytea;
  v_base64 text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if not exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id='banner-custom') then
    raise exception 'Сначала купи PHOTO BANNER в магазине.';
  end if;
  if p_data is null then
    delete from public.flare_profile_banners where account_id=v_account;
    return jsonb_build_object('ok',true);
  end if;
  if length(p_data)>700000 or p_data !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Нужна JPEG-фотография размером до 500 КБ.';
  end if;
  v_base64:=substring(p_data from 'base64,(.*)$');
  v_data:=pg_catalog.decode(v_base64,'base64');
  if octet_length(v_data)<4 or octet_length(v_data)>500000 or pg_catalog.get_byte(v_data,0)<>255 or pg_catalog.get_byte(v_data,1)<>216 or pg_catalog.get_byte(v_data,octet_length(v_data)-2)<>255 or pg_catalog.get_byte(v_data,octet_length(v_data)-1)<>217 then
    raise exception 'Файл не является корректной JPEG-фотографией.';
  end if;
  insert into public.flare_profile_banners(account_id,image_data,updated_at) values(v_account,v_data,now())
  on conflict(account_id) do update set image_data=excluded.image_data,updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.rename_boing_bob(p_token text,p_name text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_profile public.flare_boing_profiles%rowtype;
  v_name text:=regexp_replace(trim(coalesce(p_name,'')),'[[:space:]]+',' ','g');
  v_price integer;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  select * into v_profile from public.flare_boing_profiles where account_id=v_account for update;
  if char_length(v_name)<1 or char_length(v_name)>16 or v_name !~ '^[A-Za-z0-9А-Яа-яЁё _-]+$' then
    raise exception 'Имя BOB: 1–16 букв, цифр, пробелов, дефисов или подчёркиваний.';
  end if;
  if v_name=v_profile.bob_name then raise exception 'Это имя уже используется.'; end if;
  v_price:=case when v_profile.bob_rename_count<2 then 0 else 10000 end;
  if v_profile.coins<v_price then raise exception 'Нужно % COINS для переименования.',v_price; end if;
  update public.flare_boing_profiles set bob_name=v_name,bob_rename_count=bob_rename_count+1,coins=coins-v_price,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
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
  select * into v_item from public.flare_boing_items where id=p_item_id;
  if not found then raise exception 'Товар не найден.'; end if;
  v_level:=case when v_item.kind='click' then v_profile.click_level when v_item.kind='coin' then v_profile.coin_level when exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id=v_item.id) then 1 else 0 end;
  if v_level>=v_item.max_level then raise exception 'Этот товар уже куплен или улучшен до максимума.'; end if;
  v_price:=case when v_item.kind in ('click','coin') then v_item.base_price*(v_level+1) else v_item.base_price end;
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

create or replace function public.equip_boing_item(p_token text,p_item_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_kind text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if p_item_id not in ('frame-default','accessory-none') then
    select kind into v_kind from public.flare_boing_items where id=p_item_id and kind in ('frame','accessory');
    if v_kind is null or not exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id=p_item_id) then
      raise exception 'Этот аксессуар ещё не куплен.';
    end if;
  else
    v_kind:=case when p_item_id='frame-default' then 'frame' else 'accessory' end;
  end if;
  if v_kind='frame' then update public.flare_boing_profiles set selected_frame=p_item_id,updated_at=now() where account_id=v_account;
  else update public.flare_boing_profiles set selected_accessory=p_item_id,updated_at=now() where account_id=v_account; end if;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.set_boing_badge(p_token text,p_badge_id text,p_equipped boolean)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if not exists(select 1 from public.flare_account_badges where account_id=v_account and badge_id=p_badge_id) then raise exception 'Этот бейдж ещё не получен.'; end if;
  update public.flare_account_badges set equipped=coalesce(p_equipped,false) where account_id=v_account and badge_id=p_badge_id;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.mark_boing_intro_seen(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  update public.flare_boing_profiles set game_intro_seen=true,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.start_boing_run(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_run uuid:=gen_random_uuid();
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  update public.flare_boing_profiles set run_id=v_run,run_score=0,run_clicks=0,run_started_at=now(),games_played=games_played+1,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true,'run_id',v_run,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.sync_boing_run(p_token text,p_run_id uuid,p_clicks bigint,p_failed boolean default false)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_profile public.flare_boing_profiles%rowtype;
  v_delta bigint;
  v_points bigint;
  v_max_clicks bigint;
  v_new_run_score bigint;
  v_new_total_score bigint;
  v_best bigint;
  v_reward bigint:=0;
  v_milestone bigint;
  v_rate bigint;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if p_clicks is null or p_clicks<0 or p_clicks>1000000000 then raise exception 'Некорректное число кликов.'; end if;
  select * into v_profile from public.flare_boing_profiles where account_id=v_account for update;
  if v_profile.run_id is null or v_profile.run_id<>p_run_id then raise exception 'Этот раунд уже завершён.'; end if;
  v_delta:=p_clicks-v_profile.run_clicks;
  if v_delta<0 then raise exception 'Некорректное обновление раунда.'; end if;
  v_max_clicks:=floor(greatest(0,extract(epoch from now()-v_profile.run_started_at))*18)::bigint+12;
  if p_clicks>v_max_clicks then raise exception 'Клики поступают слишком быстро. Продолжай играть и попробуй снова.'; end if;
  v_points:=v_delta*(1+v_profile.click_level);
  v_new_run_score:=v_profile.run_score+v_points;
  v_new_total_score:=v_profile.total_score+v_points;
  v_best:=greatest(v_profile.best_score,v_new_run_score);
  for v_milestone in (floor(v_profile.total_score/100)::bigint + 1)..(floor(v_new_total_score/100)::bigint) loop
    v_rate:=case
      when v_milestone*100>100000 then 1000
      when v_milestone*100>50000 then 500
      when v_milestone*100>10000 then 300
      when v_milestone*100>1000 then 150
      else 100
    end;
    v_reward:=v_reward+floor(v_rate*(1+v_profile.coin_level*.2))::bigint;
  end loop;
  update public.flare_boing_profiles set
    best_score=v_best,total_score=v_new_total_score,total_clicks=total_clicks+v_delta,
    coins=coins+v_reward,coins_earned=coins_earned+v_reward,
    run_id=case when coalesce(p_failed,false) then null else run_id end,
    run_score=case when coalesce(p_failed,false) then 0 else v_new_run_score end,
    run_clicks=case when coalesce(p_failed,false) then 0 else p_clicks end,
    run_started_at=case when coalesce(p_failed,false) then null else run_started_at end,
    updated_at=now()
  where account_id=v_account;
  if v_best>=10000 then perform public.flare_grant_boing_badge(v_account,'boing-10k'); end if;
  if v_best>=100000 then perform public.flare_grant_boing_badge(v_account,'boing-100k'); end if;
  return jsonb_build_object('ok',true,'failed',coalesce(p_failed,false),'run_score',v_new_run_score,'reward',v_reward,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.get_boing_leaders(p_token text,p_sort text default 'score')
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_leaders jsonb;
begin
  perform public.flare_assert_account_access(v_account);
  if p_sort not in ('score','coins') then raise exception 'Неизвестная сортировка.'; end if;
  with players as (
    select a.nickname,p.bob_name,p.best_score,p.coins,p.total_clicks
    from public.flare_boing_profiles p join public.flare_accounts a on a.id=p.account_id
    where p.total_clicks>0 and not a.is_test_account
  ), ranked as (
    select *,row_number() over(
      order by case when p_sort='coins' then coins else best_score end desc,
        case when p_sort='coins' then best_score else coins end desc,nickname
    ) as rank from players
  ), limited as (select * from ranked order by rank limit 50)
  select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'nickname',nickname,'bob_name',bob_name,'best_score',best_score,'coins',coins,'total_clicks',total_clicks) order by rank),'[]'::jsonb)
  into v_leaders from limited;
  return jsonb_build_object('sort',p_sort,'leaders',v_leaders);
end $$;

revoke all on function public.flare_ensure_boing_profile(uuid) from public,anon,authenticated;
revoke all on function public.flare_grant_boing_badge(uuid,text) from public,anon,authenticated;
revoke all on function public.flare_boing_state(uuid) from public,anon,authenticated;
revoke all on function public.get_my_profile(text) from public,authenticated;
revoke all on function public.reveal_my_email(text) from public,authenticated;
revoke all on function public.set_my_profile_banner(text,text) from public,authenticated;
revoke all on function public.rename_boing_bob(text,text) from public,authenticated;
revoke all on function public.buy_boing_item(text,text) from public,authenticated;
revoke all on function public.equip_boing_item(text,text) from public,authenticated;
revoke all on function public.set_boing_badge(text,text,boolean) from public,authenticated;
revoke all on function public.mark_boing_intro_seen(text) from public,authenticated;
revoke all on function public.start_boing_run(text) from public,authenticated;
revoke all on function public.sync_boing_run(text,uuid,bigint,boolean) from public,authenticated;
revoke all on function public.get_boing_leaders(text,text) from public,authenticated;

grant execute on function public.get_my_profile(text) to anon;
grant execute on function public.reveal_my_email(text) to anon;
grant execute on function public.set_my_profile_banner(text,text) to anon;
grant execute on function public.rename_boing_bob(text,text) to anon;
grant execute on function public.buy_boing_item(text,text) to anon;
grant execute on function public.equip_boing_item(text,text) to anon;
grant execute on function public.set_boing_badge(text,text,boolean) to anon;
grant execute on function public.mark_boing_intro_seen(text) to anon;
grant execute on function public.start_boing_run(text) to anon;
grant execute on function public.sync_boing_run(text,uuid,bigint,boolean) to anon;
grant execute on function public.get_boing_leaders(text,text) to anon;

insert into public.flare_account_badges(account_id,badge_id,equipped)
select a.id,b.id,true from public.flare_accounts a
join public.flare_badges b on (a.nickname='Eozik' and b.id='tester') or (a.nickname='Maronnix' and b.id='creator')
on conflict(account_id,badge_id) do nothing;

commit;
