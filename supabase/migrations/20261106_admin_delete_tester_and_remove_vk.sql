begin;

-- VK is no longer exposed or accepted for style-of-year social profiles.
create or replace function public.flare_member_social_json(p_nickname text)
returns jsonb language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'nickname',s.nickname,'steam_url',s.steam_url,
    'discord_image',case when s.discord_image is not null then 'data:image/jpeg;base64,'||encode(s.discord_image,'base64') end,
    'telegram_image',case when s.telegram_image is not null then 'data:image/jpeg;base64,'||encode(s.telegram_image,'base64') end
  )) from public.flare_member_socials s where s.nickname=p_nickname
$$;

create or replace function public.admin_set_member_social(
  p_token text,p_nickname text,p_steam_url text,p_discord_image text,p_telegram_image text,p_vk_url text
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_steam text:=nullif(trim(coalesce(p_steam_url,'')),'');
  v_vk text; -- VK is retired; the legacy argument is intentionally ignored.
  v_discord bytea;v_telegram bytea;
begin
  if not exists(select 1 from public.flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  if p_nickname is null or trim(p_nickname)='FLARE_TESTER' or not exists(select 1 from public.flare_members where nickname=trim(p_nickname)) then raise exception 'Участник не найден.'; end if;
  if v_steam is not null and (length(v_steam)>500 or v_steam!~'^https?://[^[:space:]]+$') then raise exception 'Некорректная ссылка Steam.'; end if;
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

-- Remove the tester, all sessions/data and the old login authorization.
create or replace function public.admin_delete_tester_account(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_tester uuid;
begin
  if not exists(select 1 from public.flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  select id into v_tester from public.flare_accounts where nickname='FLARE_TESTER' and is_test_account;
  delete from public.flare_authorized_emails where expected_nickname='FLARE_TESTER' or is_test_account;
  if v_tester is not null then delete from public.flare_accounts where id=v_tester and is_test_account; end if;
  return jsonb_build_object('ok',true,'deleted',v_tester is not null);
end $$;

revoke all on function public.flare_member_social_json(text) from public,anon,authenticated;
revoke all on function public.admin_set_member_social(text,text,text,text,text,text) from public,authenticated;
revoke all on function public.admin_delete_tester_account(text) from public,authenticated;
grant execute on function public.admin_set_member_social(text,text,text,text,text,text) to anon;
grant execute on function public.admin_delete_tester_account(text) to anon;

commit;
