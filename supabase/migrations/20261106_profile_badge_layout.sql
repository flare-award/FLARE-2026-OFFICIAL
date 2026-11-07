-- Atomic editing of equipped profile badges.
-- Run after 20261106_bob_png_face_uploads.sql. Safe to re-run.
begin;

create or replace function public.set_my_boing_badges(p_token text,p_badge_ids jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if p_badge_ids is null or jsonb_typeof(p_badge_ids)<>'array' or jsonb_array_length(p_badge_ids)>100
    or exists(select 1 from jsonb_array_elements(p_badge_ids) as entries(value) where jsonb_typeof(value)<>'string') then
    raise exception 'Некорректный список бейджей.';
  end if;
  if exists(
    select 1 from jsonb_array_elements_text(p_badge_ids) as entries(badge_id)
    where not exists(select 1 from public.flare_account_badges ab where ab.account_id=v_account and ab.badge_id=entries.badge_id)
  ) then
    raise exception 'Можно изменять только свои полученные бейджи.';
  end if;
  update public.flare_account_badges ab
    set equipped=exists(select 1 from jsonb_array_elements_text(p_badge_ids) as entries(badge_id) where entries.badge_id=ab.badge_id)
    where ab.account_id=v_account;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
end $$;

revoke all on function public.set_my_boing_badges(text,jsonb) from public,authenticated;
grant execute on function public.set_my_boing_badges(text,jsonb) to anon;

commit;
