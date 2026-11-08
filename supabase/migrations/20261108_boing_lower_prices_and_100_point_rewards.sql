-- Economy relief: fixed prices (idempotent), no balance/ownership/history changes.
begin;
update public.flare_boing_items i set base_price=p.price
from (values
  ('click-power',3500::bigint),
  ('coin-boost',7000::bigint),
  ('banner-custom',17500::bigint),
  ('frame-gold',7000::bigint),
  ('frame-aurora',24500::bigint),
  ('frame-inferno',52500::bigint),
  ('bob-shades',3500::bigint),
  ('bob-cap',7000::bigint),
  ('bob-crown',21000::bigint),
  ('legend',1050000::bigint),
  ('bob-face-upload',21000::bigint),
  ('bob-beanie',5600::bigint),
  ('bob-fedora',10500::bigint),
  ('bob-sneakers',14000::bigint),
  ('bob-bowtie',8400::bigint),
  ('frame-eclipse',38500::bigint),
  ('bob-beard',700::bigint)) as p(id,price) where i.id=p.id;
update public.flare_boing_items set description='Больше очков за клик. COINS выдаются за каждые 100 очков одного раунда. Каждый следующий уровень дороже.' where id='click-power';

create or replace function public.flare_boing_round_reward(p_score bigint,p_level integer)
returns bigint language plpgsql immutable strict set search_path=pg_catalog as $$
begin
 if p_score<0 or p_level<0 or p_level>5 then raise exception 'Invalid BOING round score or boost level.'; end if;
 return (p_score/100)*(100+10*p_level);
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
    from public.flare_boing_items i where i.id<>'leader-bob-name'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'kind',kind,'name',name,'description',description,'level',level,'max_level',max_level,
    'owned',level>0,'sold_out',level>=max_level,'price',case when kind in ('click','coin') then public.flare_boing_upgrade_price(base_price,level) else base_price end
  ) order by sort_order,id),'[]'::jsonb) into v_shop from levels;
  return jsonb_build_object(
    'economy_version',3,'streak_version',1,'streak',public.flare_boing_streak_state(p_account),
    'reward_basis','round_score','reward_step_score',100,'reward_step_coins',100,
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
commit;
