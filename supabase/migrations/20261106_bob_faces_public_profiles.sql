-- BOB face studio, public FLARE profiles and leaderboard BOB-name visibility.
-- Run after 20261105_profiles_and_boing.sql. Safe to re-run.
begin;

alter table public.flare_boing_profiles
  add column if not exists face_data bytea,
  add column if not exists face_updated_at timestamptz;

alter table public.flare_boing_items drop constraint if exists flare_boing_items_kind_check;
alter table public.flare_boing_items
  add constraint flare_boing_items_kind_check
  check (kind in ('click','coin','frame','accessory','banner','badge','leader'));

insert into public.flare_boing_items(id,kind,name,description,base_price,max_level,sort_order) values
('leader-bob-name','leader','BOB NAME IN LEADERS','Показывать имя твоего BOB в таблице лидеров.',6000,1,95)
on conflict(id) do update set kind=excluded.kind,name=excluded.name,description=excluded.description,base_price=excluded.base_price,max_level=excluded.max_level,sort_order=excluded.sort_order;

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
  v_face text;
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
  select case when face_data is null then null else 'data:image/png;base64,'||translate(pg_catalog.encode(face_data,'base64'),E'\r\n','') end
    into v_face from public.flare_boing_profiles where account_id=v_account;
  return jsonb_build_object(
    'nickname',v_nickname,
    'created_at',v_created,
    'email_masked',case when v_email is null then 'Email не привязан' else left(split_part(v_email,'@',1),1)||'•••••@'||split_part(v_email,'@',2) end,
    'votes_done',coalesce(v_votes,0),
    'total_nominations',v_total,
    'event_answered',v_event_answered,
    'days_with_flare',greatest(0,floor(extract(epoch from now()-v_created)/86400)::integer),
    'banner',v_banner,
    'boing',public.flare_boing_state(v_account)||jsonb_build_object('face',v_face)
  );
end $$;

create or replace function public.set_my_boing_face(p_token text,p_data text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_profile public.flare_boing_profiles%rowtype;
  v_data bytea;
  v_base64 text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  select * into v_profile from public.flare_boing_profiles where account_id=v_account for update;
  if v_profile.run_id is not null then
    raise exception 'Лицо можно менять только перед началом нового раунда.';
  end if;
  if p_data is null then
    update public.flare_boing_profiles set face_data=null,face_updated_at=now(),updated_at=now() where account_id=v_account;
    return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account)||jsonb_build_object('face',null));
  end if;
  if length(p_data)>210000 or p_data !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Нужен PNG-рисунок размером до 150 КБ.';
  end if;
  v_base64:=substring(p_data from 'base64,(.*)$');
  v_data:=pg_catalog.decode(v_base64,'base64');
  if octet_length(v_data)<20 or octet_length(v_data)>150000
    or pg_catalog.get_byte(v_data,0)<>137 or pg_catalog.get_byte(v_data,1)<>80
    or pg_catalog.get_byte(v_data,2)<>78 or pg_catalog.get_byte(v_data,3)<>71
    or pg_catalog.get_byte(v_data,4)<>13 or pg_catalog.get_byte(v_data,5)<>10
    or pg_catalog.get_byte(v_data,6)<>26 or pg_catalog.get_byte(v_data,7)<>10
    or pg_catalog.get_byte(v_data,octet_length(v_data)-8)<>73
    or pg_catalog.get_byte(v_data,octet_length(v_data)-7)<>69
    or pg_catalog.get_byte(v_data,octet_length(v_data)-6)<>78
    or pg_catalog.get_byte(v_data,octet_length(v_data)-5)<>68
    or pg_catalog.get_byte(v_data,octet_length(v_data)-4)<>174
    or pg_catalog.get_byte(v_data,octet_length(v_data)-3)<>66
    or pg_catalog.get_byte(v_data,octet_length(v_data)-2)<>96
    or pg_catalog.get_byte(v_data,octet_length(v_data)-1)<>130 then
    raise exception 'Файл не является корректным PNG-рисунком.';
  end if;
  update public.flare_boing_profiles set face_data=v_data,face_updated_at=now(),updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account)||jsonb_build_object('face',p_data));
end $$;

create or replace function public.get_boing_leaders(p_token text,p_sort text default 'score')
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_leaders jsonb;
begin
  perform public.flare_assert_account_access(v_account);
  if p_sort not in ('score','coins') then raise exception 'Неизвестная сортировка.'; end if;
  with players as (
    select a.nickname,
      case when exists(select 1 from public.flare_boing_inventory inv where inv.account_id=p.account_id and inv.item_id='leader-bob-name') then p.bob_name else null end as bob_name,
      p.best_score,p.coins,p.total_clicks
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

revoke all on function public.get_my_profile(text) from public,authenticated;
revoke all on function public.set_my_boing_face(text,text) from public,authenticated;
revoke all on function public.get_boing_leaders(text,text) from public,authenticated;
revoke all on function public.get_public_flare_profile(text,text) from public,authenticated;

grant execute on function public.get_my_profile(text) to anon;
grant execute on function public.set_my_boing_face(text,text) to anon;
grant execute on function public.get_boing_leaders(text,text) to anon;
grant execute on function public.get_public_flare_profile(text,text) to anon;

commit;
