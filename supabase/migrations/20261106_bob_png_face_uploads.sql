-- Purchasable PNG photo uploads for BOB faces. Drawing remains free.
-- Run after 20261106_bob_faces_public_profiles.sql. Safe to re-run.
begin;

alter table public.flare_boing_items drop constraint if exists flare_boing_items_kind_check;
alter table public.flare_boing_items
  add constraint flare_boing_items_kind_check
  check (kind in ('click','coin','frame','accessory','banner','badge','leader','face'));

insert into public.flare_boing_items(id,kind,name,description,base_price,max_level,sort_order) values
('bob-face-upload','face','BOB PNG FACE','Загружать свои PNG-изображения на лицо BOB. Рисование остаётся бесплатным.',10000,1,96)
on conflict(id) do update set kind=excluded.kind,name=excluded.name,description=excluded.description,base_price=excluded.base_price,max_level=excluded.max_level,sort_order=excluded.sort_order;

create or replace function public.upload_my_boing_face(p_token text,p_data text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if not exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id='bob-face-upload') then
    raise exception 'Сначала купи BOB PNG FACE в категории «Косметика».';
  end if;
  return public.set_my_boing_face(p_token,p_data);
end $$;

revoke all on function public.upload_my_boing_face(text,text) from public,authenticated;
grant execute on function public.upload_my_boing_face(text,text) to anon;

commit;
