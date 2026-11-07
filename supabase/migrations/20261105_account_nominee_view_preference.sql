-- Persist each account's nominee-list layout independently of this browser.
begin;

create table if not exists public.flare_account_preferences (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  nominee_view text not null default 'standard'
    check (nominee_view in ('standard','compact','list')),
  updated_at timestamptz not null default now()
);

revoke all on public.flare_account_preferences from anon, authenticated;
alter table public.flare_account_preferences enable row level security;

create or replace function public.get_my_nominee_view(p_token text)
returns text
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_view text;
begin
  perform flare_assert_account_access(v_account);
  select nominee_view into v_view
  from public.flare_account_preferences
  where account_id=v_account;
  return v_view;
end
$$;

create or replace function public.set_my_nominee_view(p_token text,p_view text)
returns text
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_account uuid:=flare_session_account(p_token);
begin
  perform flare_assert_account_access(v_account);
  if p_view is null or p_view not in ('standard','compact','list') then
    raise exception 'Неизвестный вид списка номинантов.';
  end if;
  insert into public.flare_account_preferences(account_id,nominee_view,updated_at)
  values(v_account,p_view,now())
  on conflict(account_id) do update
    set nominee_view=excluded.nominee_view,updated_at=now();
  return p_view;
end
$$;

revoke all on function public.get_my_nominee_view(text) from public,authenticated;
revoke all on function public.set_my_nominee_view(text,text) from public,authenticated;
grant execute on function public.get_my_nominee_view(text) to anon;
grant execute on function public.set_my_nominee_view(text,text) to anon;

commit;
