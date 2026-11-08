-- Unified profile appearance editing, creator cosmetics, and the new conflict nominee.
-- Run after 20261106_profile_badge_layout.sql. Safe to re-run.
begin;

insert into public.flare_options(id,nomination_id,name,kind,person_nickname) values
('conflict-4','conflict-of-year','Izumrudik vs Cloury','image',null)
on conflict(id) do update set nomination_id=excluded.nomination_id,name=excluded.name,kind=excluded.kind,person_nickname=excluded.person_nickname;

create or replace function public.flare_ensure_boing_profile(p_account uuid)
returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  insert into public.flare_boing_profiles(account_id) values(p_account) on conflict(account_id) do nothing;
  insert into public.flare_account_badges(account_id,badge_id,equipped)
  select a.id,b.id,true from public.flare_accounts a
  join public.flare_badges b on (a.nickname='Eozik' and b.id='tester') or (a.nickname='Maronnix' and b.id='creator')
  where a.id=p_account on conflict(account_id,badge_id) do nothing;
  insert into public.flare_boing_inventory(account_id,item_id)
  select a.id,item.item_id from public.flare_accounts a
  join (values('frame-gold'),('banner-custom')) as item(item_id) on a.nickname='Maronnix'
  join public.flare_boing_items i on i.id=item.item_id
  where a.id=p_account
  on conflict(account_id,item_id) do nothing;
end $$;

-- Grant owned items directly as well, so an existing account does not need to open its profile first.
insert into public.flare_boing_inventory(account_id,item_id)
select a.id,item.item_id from public.flare_accounts a
join (values('frame-gold'),('banner-custom')) as item(item_id) on a.nickname='Maronnix' and not a.is_test_account
join public.flare_boing_items i on i.id=item.item_id
on conflict(account_id,item_id) do nothing;

create or replace function public.set_my_profile_appearance(
  p_token text,
  p_badge_ids jsonb,
  p_frame_id text,
  p_banner_data text,
  p_update_banner boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_data bytea;
  v_base64 text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  perform 1 from public.flare_boing_profiles where account_id=v_account for update;

  if p_badge_ids is null or jsonb_typeof(p_badge_ids)<>'array' or jsonb_array_length(p_badge_ids)>100
    or exists(select 1 from jsonb_array_elements(p_badge_ids) as entries(value) where jsonb_typeof(value)<>'string') then
    raise exception 'Некорректный список бейджей.';
  end if;
  if (select count(*) from jsonb_array_elements_text(p_badge_ids))<>(select count(distinct badge_id) from jsonb_array_elements_text(p_badge_ids) as entries(badge_id)) then
    raise exception 'Список бейджей содержит повторы.';
  end if;
  if exists(
    select 1 from jsonb_array_elements_text(p_badge_ids) as entries(badge_id)
    where not exists(select 1 from public.flare_account_badges ab where ab.account_id=v_account and ab.badge_id=entries.badge_id)
  ) then
    raise exception 'Можно изменять только свои полученные бейджи.';
  end if;

  if p_frame_id is null or (p_frame_id<>'frame-default' and not exists(
    select 1 from public.flare_boing_inventory inv
    join public.flare_boing_items i on i.id=inv.item_id and i.kind='frame'
    where inv.account_id=v_account and inv.item_id=p_frame_id
  )) then
    raise exception 'Можно выбрать только свою купленную рамку.';
  end if;

  if coalesce(p_update_banner,false) then
    if not exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id='banner-custom') then
      raise exception 'Сначала купи PHOTO BANNER в магазине.';
    end if;
    if p_banner_data is not null then
      if length(p_banner_data)>700000 or p_banner_data !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
        raise exception 'Нужна JPEG-фотография размером до 500 КБ.';
      end if;
      v_base64:=substring(p_banner_data from 'base64,(.*)$');
      v_data:=pg_catalog.decode(v_base64,'base64');
      if octet_length(v_data)<4 or octet_length(v_data)>500000
        or pg_catalog.get_byte(v_data,0)<>255 or pg_catalog.get_byte(v_data,1)<>216
        or pg_catalog.get_byte(v_data,octet_length(v_data)-2)<>255 or pg_catalog.get_byte(v_data,octet_length(v_data)-1)<>217 then
        raise exception 'Файл не является корректной JPEG-фотографией.';
      end if;
    end if;
  end if;

  update public.flare_account_badges ab
    set equipped=exists(select 1 from jsonb_array_elements_text(p_badge_ids) as entries(badge_id) where entries.badge_id=ab.badge_id)
    where ab.account_id=v_account;
  update public.flare_boing_profiles set selected_frame=p_frame_id,updated_at=now() where account_id=v_account;

  if coalesce(p_update_banner,false) then
    if p_banner_data is null then
      delete from public.flare_profile_banners where account_id=v_account;
    else
      insert into public.flare_profile_banners(account_id,image_data,updated_at) values(v_account,v_data,now())
      on conflict(account_id) do update set image_data=excluded.image_data,updated_at=now();
    end if;
  end if;

  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
end $$;

revoke all on function public.set_my_profile_appearance(text,jsonb,text,text,boolean) from public,authenticated;
grant execute on function public.set_my_profile_appearance(text,jsonb,text,text,boolean) to anon;

commit;
