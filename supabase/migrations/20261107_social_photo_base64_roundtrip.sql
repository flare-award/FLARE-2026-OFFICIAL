-- Fix social-photo round trips without changing any stored photos or member data.
-- Input compatibility also covers forms opened before this migration.
create or replace function public.flare_member_social_json(p_nickname text)
returns jsonb language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'nickname',s.nickname,'steam_url',s.steam_url,
    'discord_image',case when s.discord_image is not null then 'data:image/jpeg;base64,'||replace(encode(s.discord_image,'base64'),chr(10),'') end,
    'telegram_image',case when s.telegram_image is not null then 'data:image/jpeg;base64,'||replace(encode(s.telegram_image,'base64'),chr(10),'') end
  )) from public.flare_member_socials s where s.nickname=p_nickname
$$;

create or replace function public.admin_set_member_social(
  p_token text,p_nickname text,p_steam_url text,p_discord_image text,p_telegram_image text
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_steam text:=nullif(trim(coalesce(p_steam_url,'')),'');
  v_discord bytea;v_telegram bytea;
begin
  if not exists(select 1 from public.flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  if p_nickname is null or trim(p_nickname)='FLARE_TESTER' or not exists(select 1 from public.flare_members where nickname=trim(p_nickname)) then raise exception 'Участник не найден.'; end if;
  if v_steam is not null and (length(v_steam)>500 or v_steam!~'^https?://[^[:space:]]+$') then raise exception 'Некорректная ссылка Steam.'; end if;
  -- PostgreSQL encode(bytea, 'base64') wraps lines; older clients may send those back.
  p_discord_image:=regexp_replace(p_discord_image,'[[:space:]]','','g');
  p_telegram_image:=regexp_replace(p_telegram_image,'[[:space:]]','','g');
  if p_discord_image is not null then
    if length(p_discord_image)>1200023 or p_discord_image!~'^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Фото Discord должно быть JPEG до 900 КБ.'; end if;
    v_discord:=decode(substring(p_discord_image from 'base64,(.*)$'),'base64');
    if octet_length(v_discord)<4 or octet_length(v_discord)>900000 or get_byte(v_discord,0)<>255 or get_byte(v_discord,1)<>216 or get_byte(v_discord,octet_length(v_discord)-2)<>255 or get_byte(v_discord,octet_length(v_discord)-1)<>217 then raise exception 'Некорректное JPEG-фото Discord.'; end if;
  end if;
  if p_telegram_image is not null then
    if length(p_telegram_image)>1200023 or p_telegram_image!~'^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Фото Telegram должно быть JPEG до 900 КБ.'; end if;
    v_telegram:=decode(substring(p_telegram_image from 'base64,(.*)$'),'base64');
    if octet_length(v_telegram)<4 or octet_length(v_telegram)>900000 or get_byte(v_telegram,0)<>255 or get_byte(v_telegram,1)<>216 or get_byte(v_telegram,octet_length(v_telegram)-2)<>255 or get_byte(v_telegram,octet_length(v_telegram)-1)<>217 then raise exception 'Некорректное JPEG-фото Telegram.'; end if;
  end if;
  insert into public.flare_member_socials(nickname,steam_url,discord_image,telegram_image,updated_at)
  values(trim(p_nickname),v_steam,v_discord,v_telegram,now())
  on conflict(nickname) do update set steam_url=excluded.steam_url,discord_image=excluded.discord_image,telegram_image=excluded.telegram_image,updated_at=now();
  return public.flare_member_social_json(trim(p_nickname));
end $$;

revoke all on function public.flare_member_social_json(text) from public,anon,authenticated;
revoke all on function public.admin_set_member_social(text,text,text,text,text) from public,authenticated;
grant execute on function public.admin_set_member_social(text,text,text,text,text) to anon;
