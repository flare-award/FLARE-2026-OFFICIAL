-- BOING economy v2: verified clicks, +10% boost, quadratic upgrade prices, more cosmetics.
-- Does not reset balances, earned coins, upgrade levels, inventory or running rounds.
-- Apply once through Supabase migrations; safe to run again.
begin;

create or replace function public.flare_boing_upgrade_price(p_base bigint,p_level integer)
returns bigint language sql immutable strict set search_path=pg_catalog as $$
  select p_base*(p_level+1)::bigint*(p_level+1)::bigint;
$$;

create or replace function public.flare_boing_click_reward(p_before bigint,p_after bigint,p_level integer)
returns bigint language plpgsql immutable strict set search_path=pg_catalog as $$
declare v_before bigint; v_after bigint;
begin
  if p_before<0 or p_after<p_before or p_level<0 or p_level>5 then
    raise exception 'Invalid BOING reward range or level.';
  end if;
  v_before:=p_before/100; v_after:=p_after/100;
  -- Milestones 100..9900 pay 100; the 10000 milestone and later pay 200.
  -- Integer arithmetic, +10% per level, independent of sync batching and run boundaries.
  return (least(v_after,99)-least(v_before,99))*(100+10*p_level)
       +(greatest(v_after-99,0)-greatest(v_before-99,0))*(200+20*p_level);
end $$;

revoke all on function public.flare_boing_upgrade_price(bigint,integer) from public,anon,authenticated;
revoke all on function public.flare_boing_click_reward(bigint,bigint,integer) from public,anon,authenticated;

insert into public.flare_boing_items(id,kind,name,description,base_price,max_level,sort_order) values
('click-power','click','POWER CLICK','Больше очков за клик. Не ускоряет получение COINS. Каждый следующий уровень дороже.',5000,5,10),
('coin-boost','coin','COINS BOOST','На 10% больше COINS за уровень. Каждый следующий уровень дороже.',10000,5,20),
('banner-custom','banner','PHOTO BANNER','Загрузка фотографии для обложки профиля.',25000,1,30),
('frame-gold','frame','GOLD FRAME','Золотая рамка вокруг аватара.',10000,1,40),
('frame-aurora','frame','AURORA FRAME','Переливающаяся рамка вокруг аватара.',35000,1,50),
('frame-inferno','frame','INFERNO FRAME','Огненная рамка вокруг аватара.',75000,1,60),
('bob-shades','accessory','BOB SHADES','Минималистичные тёмные очки для BOB.',5000,1,70),
('bob-cap','accessory','BOB CAP','Маленькая кепка для BOB.',10000,1,80),
('bob-crown','accessory','BOB CROWN','Корона для настоящего чемпиона.',30000,1,90),
('bob-beanie','accessory','BOB BEANIE','Тёплая вязаная шапка: голова в тепле, рекорд под угрозой.',8000,1,91),
('bob-fedora','accessory','BOB FEDORA','Шляпа для серьёзного BOB с несерьёзной гравитацией.',15000,1,92),
('bob-sneakers','accessory','BOB SNEAKERS','Пара кед. Прыжок тот же, приземление моднее.',20000,1,93),
('bob-bowtie','accessory','BOB BOW TIE','Бабочка для торжественного падения.',12000,1,94),
('leader-bob-name','leader','BOB NAME IN LEADERS','Показывать имя твоего BOB справа от ника в таблице лидеров.',18000,1,95),
('bob-face-upload','face','BOB PNG FACE','Загружать свои PNG-изображения на лицо BOB. Рисование остаётся бесплатным.',30000,1,96),
('legend','badge','LEGEND BADGE','Очень редкий бейдж для профиля.',1500000,1,100)
on conflict(id) do update set kind=excluded.kind,name=excluded.name,description=excluded.description,base_price=excluded.base_price,max_level=excluded.max_level,sort_order=excluded.sort_order;

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
    'economy_version',2,
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
  -- Rewards count verified clicks, never score multiplied by POWER CLICK.
  v_reward:=public.flare_boing_click_reward(v_profile.total_clicks,v_profile.total_clicks+v_delta,v_profile.coin_level);
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

commit;
