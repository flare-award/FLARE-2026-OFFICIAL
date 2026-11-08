begin;

-- Profile reputation: one mutable reaction per viewer and profile.
create table if not exists public.flare_profile_reputations(
  viewer_id uuid not null references public.flare_accounts(id) on delete cascade,
  target_id uuid not null references public.flare_accounts(id) on delete cascade,
  value smallint not null check(value in (-1,1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(viewer_id,target_id),
  check(viewer_id<>target_id)
);
alter table public.flare_profile_reputations enable row level security;
revoke all on public.flare_profile_reputations from anon,authenticated;

-- Manually managed social profiles. Photos stay private to the table and are
-- exposed only by the explicit RPCs below.
create table if not exists public.flare_member_socials(
  nickname text primary key references public.flare_members(nickname) on delete cascade,
  steam_url text,
  discord_image bytea,
  telegram_image bytea,
  vk_url text,
  updated_at timestamptz not null default now()
);
alter table public.flare_member_socials enable row level security;
revoke all on public.flare_member_socials from anon,authenticated;

insert into public.flare_badges(id,name,description,rarity,sort_order) values
  ('community-favorite','Любимец сообщества','Получил 5 больших пальцев вверх от участников','special',7),
  ('winner-flare-king','Победитель · FLARE KING','Победа в номинации «FLARE KING» в 2026 году','legendary',10),
  ('winner-multigaming','Победитель · MULTIGAMING года','Победа в номинации «MULTIGAMING ГОДА» в 2026 году','legendary',11),
  ('winner-best-cs','Победитель · Лучший CS-участник','Победа в номинации «ЛУЧШИЙ CS-УЧАСТНИК» в 2026 году','legendary',12),
  ('winner-best-rematch','Победитель · Лучший RM-участник','Победа в номинации «ЛУЧШИЙ RM-УЧАСТНИК» в 2026 году','legendary',13),
  ('winner-meme-of-year','Победитель · Человек-мем года','Победа в номинации «ЧЕЛОВЕК-МЕМ ГОДА» в 2026 году','legendary',14),
  ('winner-breakthrough','Победитель · Прорыв года','Победа в номинации «ПРОРЫВ ГОДА» в 2026 году','legendary',15),
  ('winner-vibe-of-year','Победитель · Вайб года','Победа в номинации «ВАЙБ ГОДА» в 2026 году','legendary',16),
  ('winner-scam-of-year','Победитель · Кидалово года','Победа в номинации «КИДАЛОВО ГОДА» в 2026 году','legendary',17),
  ('winner-style-of-year','Победитель · Стиль года','Победа в номинации «СТИЛЬ ГОДА» в 2026 году','legendary',18),
  ('winner-aura-of-year','Победитель · Аура года','Победа в номинации «АУРА ГОДА» в 2026 году','legendary',19),
  ('winner-chatter-of-year','Победитель · Чаттер года','Победа в номинации «ЧАТТЕР ГОДА» в 2026 году','legendary',20),
  ('winner-shame-of-year','Победитель · Позор года','Победа в номинации «ПОЗОР ГОДА» в 2026 году','legendary',21)
on conflict(id) do update set name=excluded.name,description=excluded.description,rarity=excluded.rarity,sort_order=excluded.sort_order;

create or replace function public.flare_equip_profile_badge(p_account uuid,p_badge_id text)
returns void language sql security definer set search_path=public,extensions,pg_temp as $$
  insert into public.flare_account_badges(account_id,badge_id,equipped) values(p_account,p_badge_id,true)
  on conflict(account_id,badge_id) do nothing
$$;

-- Winner badges become available on 6 December 2026 at 00:00 (UTC+3),
-- after 5 December has ended. Leading vote tallies decide winners; ties share the win.
create or replace function public.flare_sync_profile_achievement_badges(p_account uuid)
returns boolean language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_upvotes integer;
  v_before integer;
  v_after integer;
begin
  if p_account is null or not exists(select 1 from public.flare_accounts where id=p_account) then return false; end if;
  perform public.flare_ensure_boing_profile(p_account);
  select count(*)::integer into v_before from public.flare_account_badges where account_id=p_account;
  select count(*)::integer into v_upvotes from public.flare_profile_reputations r
  join public.flare_accounts viewer on viewer.id=r.viewer_id and not viewer.is_test_account
  where r.target_id=p_account and r.value=1;
  if v_upvotes>=5 then perform public.flare_equip_profile_badge(p_account,'community-favorite'); end if;

  if now()>='2026-12-06 00:00:00+03'::timestamptz then
    perform public.flare_equip_profile_badge(p_account,'winner-'||o.nomination_id)
    from public.flare_options o
    where o.kind='person'
      and o.person_nickname=(select nickname from public.flare_accounts where id=p_account)
      and exists(select 1 from public.flare_badges b where b.id='winner-'||o.nomination_id)
      and (select count(*) from public.flare_votes v where v.nomination_id=o.nomination_id and v.option_id=o.id)=(
        select max(tally.vote_count) from (
          select count(*)::integer as vote_count from public.flare_votes where nomination_id=o.nomination_id group by option_id
        ) tally
      );
  end if;
  select count(*)::integer into v_after from public.flare_account_badges where account_id=p_account;
  return v_after>v_before;
end $$;

create or replace function public.flare_profile_reputation_json(p_viewer uuid,p_target uuid)
returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare
  v_up integer;v_down integer;v_value integer;
begin
  select count(*) filter(where value=1)::integer,count(*) filter(where value=-1)::integer into v_up,v_down
  from public.flare_profile_reputations r join public.flare_accounts viewer on viewer.id=r.viewer_id and not viewer.is_test_account
  where r.target_id=p_target;
  if p_viewer is not null then select value into v_value from public.flare_profile_reputations where viewer_id=p_viewer and target_id=p_target; end if;
  return jsonb_build_object('up',coalesce(v_up,0),'down',coalesce(v_down,0),'viewer_value',v_value,'can_rate',p_viewer is not null and p_viewer<>p_target);
end $$;

-- Run before the existing profile RPC so newly earned badges are included in it.
create or replace function public.prepare_flare_profile(p_token text,p_nickname text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_viewer uuid:=public.flare_session_account(p_token);
  v_target uuid;
  v_nickname text:=nullif(trim(coalesce(p_nickname,'')),'');
begin
  perform public.flare_assert_account_access(v_viewer);
  if v_nickname is null then v_target:=v_viewer;
  else
    if v_nickname='FLARE_TESTER' then raise exception 'Этот профиль недоступен.'; end if;
    select a.id into v_target from public.flare_members m join public.flare_accounts a on a.nickname=m.nickname where m.nickname=v_nickname;
    if v_target is null then raise exception 'Профиль участника не найден.'; end if;
  end if;
  perform public.flare_sync_profile_achievement_badges(v_target);
  return public.flare_profile_reputation_json(v_viewer,v_target);
end $$;

create or replace function public.set_profile_reputation(p_token text,p_nickname text,p_value integer)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_viewer uuid:=public.flare_session_account(p_token);
  v_target uuid;
  v_previous integer;
  v_next integer;
  v_had_badge boolean;
  v_awarded boolean:=false;
begin
  perform public.flare_assert_account_access(v_viewer);
  if coalesce(p_value,0) not in (-1,0,1) then raise exception 'Неизвестная оценка.'; end if;
  if p_nickname is null or trim(p_nickname)='FLARE_TESTER' then raise exception 'Этот профиль недоступен.'; end if;
  select a.id into v_target from public.flare_members m join public.flare_accounts a on a.nickname=m.nickname where m.nickname=trim(p_nickname);
  if v_target is null then raise exception 'Профиль участника не найден.'; end if;
  if v_target=v_viewer then raise exception 'Нельзя оценить собственный профиль.'; end if;
  select value into v_previous from public.flare_profile_reputations where viewer_id=v_viewer and target_id=v_target;
  v_next:=case when coalesce(p_value,0)=coalesce(v_previous,0) then 0 else p_value end;
  if coalesce(v_next,0)=0 then delete from public.flare_profile_reputations where viewer_id=v_viewer and target_id=v_target;
  else
    insert into public.flare_profile_reputations(viewer_id,target_id,value,updated_at) values(v_viewer,v_target,v_next,now())
    on conflict(viewer_id,target_id) do update set value=excluded.value,updated_at=now();
  end if;
  select exists(select 1 from public.flare_account_badges where account_id=v_target and badge_id='community-favorite') into v_had_badge;
  perform public.flare_sync_profile_achievement_badges(v_target);
  v_awarded:=not v_had_badge and exists(select 1 from public.flare_account_badges where account_id=v_target and badge_id='community-favorite');
  return jsonb_build_object('reputation',public.flare_profile_reputation_json(v_viewer,v_target),'awarded',v_awarded,'value',coalesce(v_next,0));
end $$;

create or replace function public.flare_member_social_json(p_nickname text)
returns jsonb language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'nickname',s.nickname,'steam_url',s.steam_url,'vk_url',s.vk_url,
    'discord_image',case when s.discord_image is not null then 'data:image/jpeg;base64,'||encode(s.discord_image,'base64') end,
    'telegram_image',case when s.telegram_image is not null then 'data:image/jpeg;base64,'||encode(s.telegram_image,'base64') end
  )) from public.flare_member_socials s where s.nickname=p_nickname
$$;

create or replace function public.get_member_socials(p_token text,p_nickname text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  if p_nickname is null or trim(p_nickname)='FLARE_TESTER' or not exists(select 1 from public.flare_members where nickname=trim(p_nickname)) then raise exception 'Профиль участника не найден.'; end if;
  return coalesce(public.flare_member_social_json(trim(p_nickname)),jsonb_build_object('nickname',trim(p_nickname)));
end $$;

create or replace function public.admin_get_member_socials(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
  if not exists(select 1 from public.flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('nickname',m.nickname)||coalesce(public.flare_member_social_json(m.nickname),'{}'::jsonb) order by m.nickname) from public.flare_members m where m.nickname<>'FLARE_TESTER'),'[]'::jsonb);
end $$;

create or replace function public.admin_set_member_social(
  p_token text,p_nickname text,p_steam_url text,p_discord_image text,p_telegram_image text,p_vk_url text
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_steam text:=nullif(trim(coalesce(p_steam_url,'')),'');
  v_vk text:=nullif(trim(coalesce(p_vk_url,'')),'');
  v_discord bytea;v_telegram bytea;
begin
  if not exists(select 1 from public.flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  if p_nickname is null or trim(p_nickname)='FLARE_TESTER' or not exists(select 1 from public.flare_members where nickname=trim(p_nickname)) then raise exception 'Участник не найден.'; end if;
  if v_steam is not null and (length(v_steam)>500 or v_steam!~'^https?://[^[:space:]]+$') then raise exception 'Некорректная ссылка Steam.'; end if;
  if v_vk is not null and (length(v_vk)>500 or v_vk!~'^https?://[^[:space:]]+$') then raise exception 'Некорректная ссылка VK.'; end if;
  if p_discord_image is not null then
    if length(p_discord_image)>1200000 or p_discord_image!~'^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Фото Discord должно быть JPEG до 900 КБ.'; end if;
    v_discord:=decode(substring(p_discord_image from 'base64,(.*)$'),'base64');
    if octet_length(v_discord)<4 or octet_length(v_discord)>900000 or get_byte(v_discord,0)<>255 or get_byte(v_discord,1)<>216 or get_byte(v_discord,octet_length(v_discord)-2)<>255 or get_byte(v_discord,octet_length(v_discord)-1)<>217 then raise exception 'Некорректное JPEG-фото Discord.'; end if;
  end if;
  if p_telegram_image is not null then
    if length(p_telegram_image)>1200000 or p_telegram_image!~'^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Фото Telegram должно быть JPEG до 900 КБ.'; end if;
    v_telegram:=decode(substring(p_telegram_image from 'base64,(.*)$'),'base64');
    if octet_length(v_telegram)<4 or octet_length(v_telegram)>900000 or get_byte(v_telegram,0)<>255 or get_byte(v_telegram,1)<>216 or get_byte(v_telegram,octet_length(v_telegram)-2)<>255 or get_byte(v_telegram,octet_length(v_telegram)-1)<>217 then raise exception 'Некорректное JPEG-фото Telegram.'; end if;
  end if;
  insert into public.flare_member_socials(nickname,steam_url,discord_image,telegram_image,vk_url,updated_at)
  values(trim(p_nickname),v_steam,v_discord,v_telegram,v_vk,now())
  on conflict(nickname) do update set steam_url=excluded.steam_url,discord_image=excluded.discord_image,telegram_image=excluded.telegram_image,vk_url=excluded.vk_url,updated_at=now();
  return public.flare_member_social_json(trim(p_nickname));
end $$;

revoke all on function public.flare_equip_profile_badge(uuid,text) from public,anon,authenticated;
revoke all on function public.flare_sync_profile_achievement_badges(uuid) from public,anon,authenticated;
revoke all on function public.flare_profile_reputation_json(uuid,uuid) from public,anon,authenticated;
revoke all on function public.flare_member_social_json(text) from public,anon,authenticated;
revoke all on function public.prepare_flare_profile(text,text) from public,authenticated;
revoke all on function public.set_profile_reputation(text,text,integer) from public,authenticated;
revoke all on function public.get_member_socials(text,text) from public,authenticated;
revoke all on function public.admin_get_member_socials(text) from public,authenticated;
revoke all on function public.admin_set_member_social(text,text,text,text,text,text) from public,authenticated;

grant execute on function public.prepare_flare_profile(text,text) to anon;
grant execute on function public.set_profile_reputation(text,text,integer) to anon;
grant execute on function public.get_member_socials(text,text) to anon;
grant execute on function public.admin_get_member_socials(text) to anon;
grant execute on function public.admin_set_member_social(text,text,text,text,text,text) to anon;

commit;
