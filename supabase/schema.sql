-- FLARE 2026 secure custom email + PIN backend for Supabase.
-- Run in Supabase SQL Editor as project owner. Never expose service_role keys to the browser.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.flare_members (
  nickname text primary key,
  constraint flare_members_nickname_known check (nickname in ('Akirakume','Awal','Balabol','Cloury','Dony_zq','Eozik','Flourin','Izumrudik','Maronnix','Nodben','Qusti','Rezo1n','FLARE_TESTER'))
);
ALTER TABLE public.flare_members DROP CONSTRAINT IF EXISTS flare_members_nickname_known;
ALTER TABLE public.flare_members ADD CONSTRAINT flare_members_nickname_known CHECK (nickname in ('Akirakume','Awal','Balabol','Cloury','Dony_zq','Eozik','Flourin','Izumrudik','Maronnix','Nodben','Qusti','Rezo1n','FLARE_TESTER'));
insert into public.flare_members(nickname) values
('Akirakume'),('Awal'),('Balabol'),('Cloury'),('Dony_zq'),('Eozik'),('Flourin'),('Izumrudik'),('Maronnix'),('Nodben'),('Qusti'),('Rezo1n'),('FLARE_TESTER') on conflict do nothing;

-- Organizers pre-authorize email addresses here. First registration attaches the email to a member.
-- Keep the email list in Supabase, not in public GitHub files.
create table if not exists public.flare_authorized_emails (
  email text primary key check (email = lower(trim(email))),
  expected_nickname text not null references public.flare_members(nickname),
  account_id uuid null,
  is_test_account boolean not null default false,
  created_at timestamptz not null default now()
);
ALTER TABLE public.flare_authorized_emails ADD COLUMN IF NOT EXISTS is_test_account boolean not null default false;
ALTER TABLE public.flare_authorized_emails DROP CONSTRAINT IF EXISTS flare_authorized_emails_test_identity_check;
ALTER TABLE public.flare_authorized_emails ADD CONSTRAINT flare_authorized_emails_test_identity_check CHECK ((is_test_account and expected_nickname='FLARE_TESTER') or (not is_test_account and expected_nickname<>'FLARE_TESTER'));
create table if not exists public.flare_accounts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique references public.flare_members(nickname),
  pin_hash text not null,
  is_test_account boolean not null default false,
  ballot_submitted_at timestamptz,
  created_at timestamptz not null default now()
);
ALTER TABLE public.flare_accounts ADD COLUMN IF NOT EXISTS is_test_account boolean not null default false;
UPDATE public.flare_accounts SET is_test_account=true WHERE nickname='FLARE_TESTER';
alter table public.flare_authorized_emails drop constraint if exists flare_authorized_emails_account_id_fkey;
alter table public.flare_authorized_emails add constraint flare_authorized_emails_account_id_fkey foreign key(account_id) references public.flare_accounts(id) on delete cascade;
create table if not exists public.flare_login_attempts (
  email text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);
create table if not exists public.flare_sessions (
  token_hash text primary key,
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists flare_sessions_account_idx on public.flare_sessions(account_id);

create table if not exists public.flare_nominations (
  id text primary key,
  title text not null,
  category text not null check(category in ('основная','доп.')),
  display_type text not null check(display_type in ('Участник','Картинка','Видео')),
  allow_self boolean not null default false
);
create table if not exists public.flare_options (
  id text primary key,
  nomination_id text not null references public.flare_nominations(id) on delete cascade,
  name text not null,
  kind text not null check(kind in ('person','image','video','game','group','conflict')),
  person_nickname text references public.flare_members(nickname),
  unique(nomination_id,id),
  check (kind='person' or (kind<>'person' and person_nickname is null))
);
alter table public.flare_options add column if not exists video_url text;
alter table public.flare_options add column if not exists hidden_for_testers boolean not null default false;
create table if not exists public.flare_votes (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  nomination_id text not null references public.flare_nominations(id),
  option_id text not null,
  updated_at timestamptz not null default now(),
  primary key(account_id,nomination_id),
  foreign key(nomination_id,option_id) references public.flare_options(nomination_id,id)
);
create table if not exists public.flare_event_choices (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  choice_id text not null check(choice_id in ('dec-4','dec-5','dec-6')),
  updated_at timestamptz not null default now()
);
create table if not exists public.flare_test_votes (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  nomination_id text not null references public.flare_nominations(id),
  option_id text not null,
  updated_at timestamptz not null default now(),
  primary key(account_id,nomination_id),
  foreign key(nomination_id,option_id) references public.flare_options(nomination_id,id)
);
create table if not exists public.flare_test_event_choices (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  choice_id text not null check(choice_id in ('dec-4','dec-5','dec-6')),
  updated_at timestamptz not null default now()
);
create table if not exists public.flare_account_preferences (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  nominee_view text not null default 'standard' check(nominee_view in ('standard','compact','list')),
  updated_at timestamptz not null default now()
);
create table if not exists public.flare_access_settings (
  singleton boolean primary key default true check(singleton),
  accounts_closed boolean not null default false
);
INSERT INTO public.flare_access_settings(singleton,accounts_closed) VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;

REVOKE ALL ON public.flare_members, public.flare_authorized_emails, public.flare_accounts, public.flare_sessions, public.flare_login_attempts, public.flare_nominations, public.flare_options, public.flare_votes, public.flare_event_choices, public.flare_test_votes, public.flare_test_event_choices, public.flare_account_preferences, public.flare_access_settings FROM anon, authenticated;
ALTER TABLE public.flare_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_event_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_test_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_test_event_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_account_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_access_settings ENABLE ROW LEVEL SECURITY;

create or replace function public.flare_closed() returns boolean language sql stable as $$
  select now() >= timestamptz '2026-11-22 00:00:00+03'
$$;
create or replace function public.flare_assert_account_access(p_account uuid) returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  if coalesce((select accounts_closed from public.flare_access_settings where singleton),false)
     and not exists(select 1 from public.flare_accounts where id=p_account and (nickname='Maronnix' or is_test_account)) then
    raise exception 'Доступ к аккаунтам временно закрыт.';
  end if;
end $$;
create or replace function public.flare_new_session(p_account uuid) returns text language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_token text := encode(extensions.gen_random_bytes(32),'hex');
begin
  insert into flare_sessions(token_hash,account_id,expires_at) values (encode(extensions.digest(v_token,'sha256'),'hex'),p_account,now()+interval '45 days');
  return v_token;
end $$;
create or replace function public.flare_session_account(p_token text) returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id uuid;
begin
  if p_token is null or length(p_token) < 40 then raise exception 'Сессия недействительна. Войди снова.'; end if;
  select account_id into v_id from flare_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
  if v_id is null then raise exception 'Сессия истекла. Войди снова.'; end if;
  return v_id;
end $$;

create or replace function public.flare_logout(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  if p_token is not null then delete from flare_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); end if;
  return jsonb_build_object('ok',true);
end $$;

-- Remove the former public entry points that accepted a client-selected nickname.
drop function if exists public.flare_register(text,text,text);
drop function if exists public.flare_login(text,text,text);

-- One email + PIN endpoint. The email allowlist silently supplies the nickname.
create or replace function public.flare_access(p_email text,p_pin text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_expected text;
  v_linked uuid;
  v_is_test_email boolean:=false;
  v_is_test_account boolean:=false;
  v_accounts_closed boolean:=false;
  v_account uuid;
  v_nickname text;
  v_pin_hash text;
  v_token text;
  v_attempts integer;
  v_window timestamptz;
  v_block timestamptz;
  v_allowed boolean:=false;
  v_create boolean:=false;
begin
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or length(v_email)>254 or p_pin is null or p_pin !~ '^[A-Za-z0-9]{4,72}$' then
    return jsonb_build_object('error','Не удалось войти. Проверь email и PIN-код.');
  end if;

  perform pg_advisory_xact_lock(hashtext('email:'||v_email));
  insert into flare_login_attempts(email) values(v_email) on conflict(email) do nothing;
  select attempts,window_started_at,blocked_until into v_attempts,v_window,v_block
    from flare_login_attempts where email=v_email for update;
  if v_block is not null and v_block>now() then
    return jsonb_build_object('error','Не удалось войти. Проверь email и PIN-код.');
  end if;

  select expected_nickname,account_id,is_test_account into v_expected,v_linked,v_is_test_email
    from flare_authorized_emails where email=v_email for update;
  v_allowed:=found and v_expected is not null;
  select coalesce(accounts_closed,false) into v_accounts_closed from flare_access_settings where singleton;
  if v_accounts_closed and v_expected is distinct from 'Maronnix' and not coalesce(v_is_test_email,false) then
    v_allowed:=false;
  end if;

  if v_allowed then
    perform pg_advisory_xact_lock(hashtext('member:'||v_expected));
    select id,nickname,pin_hash,is_test_account into v_account,v_nickname,v_pin_hash,v_is_test_account
      from flare_accounts where nickname=v_expected for update;
    if found then
      if (v_linked is not null and v_linked<>v_account)
         or extensions.crypt(p_pin,v_pin_hash) is distinct from v_pin_hash
         or v_is_test_account is distinct from coalesce(v_is_test_email,false) then
        v_allowed:=false;
      end if;
    else
      if v_linked is not null then
        v_allowed:=false;
      else
        v_create:=true;
        v_is_test_account:=coalesce(v_is_test_email,false);
      end if;
    end if;
  end if;

  if v_allowed then
    if v_create then
      insert into flare_accounts(nickname,pin_hash,is_test_account)
        values(v_expected,extensions.crypt(p_pin,extensions.gen_salt('bf',12)),v_is_test_account)
        returning id,nickname into v_account,v_nickname;
    end if;
    update flare_authorized_emails set account_id=v_account
      where expected_nickname=v_expected and (account_id is null or account_id=v_account);
    delete from flare_login_attempts where email=v_email;
    v_token:=flare_new_session(v_account);
    return jsonb_build_object('token',v_token,'nickname',v_nickname,'is_test_account',v_is_test_account,
      'hidden_option_ids',case when v_is_test_account then (select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from flare_options where hidden_for_testers) else '[]'::jsonb end,
      'ballot_submitted',(select ballot_submitted_at is not null from flare_accounts where id=v_account));
  end if;

  if v_window<now()-interval '15 minutes' then v_attempts:=0; v_window:=now(); end if;
  v_attempts:=v_attempts+1;
  update flare_login_attempts set attempts=v_attempts,window_started_at=v_window,
    blocked_until=case when v_attempts>=5 then now()+interval '15 minutes' else null end
    where email=v_email;
  return jsonb_build_object('error','Не удалось войти. Проверь email и PIN-код.');
end $$;

create or replace function public.get_my_ballot(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_is_test_account boolean:=false;
  v_votes jsonb;
  v_event_choice text;
  v_event_results jsonb;
  v_hidden_options jsonb:='[]'::jsonb;
begin
  perform flare_assert_account_access(v_account);
  select is_test_account into v_is_test_account from flare_accounts where id=v_account;
  if v_is_test_account then
    select coalesce(jsonb_object_agg(nomination_id,option_id),'{}'::jsonb) into v_votes from flare_test_votes where account_id=v_account;
    select choice_id into v_event_choice from flare_test_event_choices where account_id=v_account;
    select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into v_hidden_options from flare_options where hidden_for_testers;
  else
    select coalesce(jsonb_object_agg(nomination_id,option_id),'{}'::jsonb) into v_votes from flare_votes where account_id=v_account;
    select choice_id into v_event_choice from flare_event_choices where account_id=v_account;
  end if;
  if v_event_choice is not null then
    select jsonb_build_object('total',coalesce(sum(votes),0),'counts',coalesce(jsonb_object_agg(choice_id,votes),'{}'::jsonb)) into v_event_results
    from (select choice_id,count(*)::integer as votes from flare_event_choices group by choice_id) poll_counts;
  end if;
  return jsonb_build_object(
    'votes',coalesce(v_votes,'{}'::jsonb),
    'event_choice',v_event_choice,
    'event_results',v_event_results,
    'ballot_submitted',(select ballot_submitted_at is not null from flare_accounts where id=v_account),
    'is_test_account',coalesce(v_is_test_account,false),
    'hidden_option_ids',v_hidden_options
  );
end $$;

create or replace function public.get_my_nominee_view(p_token text) returns text language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_view text;
begin
  perform flare_assert_account_access(v_account);
  select nominee_view into v_view from public.flare_account_preferences where account_id=v_account;
  return v_view;
end $$;

create or replace function public.set_my_nominee_view(p_token text,p_view text) returns text language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
begin
  perform flare_assert_account_access(v_account);
  if p_view is null or p_view not in ('standard','compact','list') then raise exception 'Неизвестный вид списка номинантов.'; end if;
  insert into public.flare_account_preferences(account_id,nominee_view,updated_at) values(v_account,p_view,now())
  on conflict(account_id) do update set nominee_view=excluded.nominee_view,updated_at=now();
  return p_view;
end $$;

create or replace function public.cast_vote(p_token text,p_nomination_id text,p_option_id text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_nickname text; v_is_test_account boolean:=false;
begin
  perform flare_assert_account_access(v_account);
  if flare_closed() then raise exception 'Голосование завершено. Голоса больше нельзя изменить.'; end if;
  select nickname,is_test_account into v_nickname,v_is_test_account from flare_accounts where id=v_account;
  if not exists(select 1 from flare_options o join flare_nominations n on n.id=o.nomination_id where o.id=p_option_id and o.nomination_id=p_nomination_id) then raise exception 'Такого номинанта нет.'; end if;
  if v_is_test_account and exists(select 1 from flare_options where id=p_option_id and nomination_id=p_nomination_id and hidden_for_testers) then raise exception 'Этот номинант скрыт в тестовом режиме.'; end if;
  if exists(select 1 from flare_options o join flare_nominations n on n.id=o.nomination_id where o.id=p_option_id and o.nomination_id=p_nomination_id and o.kind='person' and o.person_nickname=v_nickname and not n.allow_self) then raise exception 'Нельзя голосовать за себя.'; end if;
  if p_nomination_id='clip-of-year' and exists(
    select 1 from flare_options o where o.id=p_option_id and o.nomination_id=p_nomination_id
    and lower(v_nickname)=any(regexp_split_to_array(lower(o.name),'[^[:alnum:]_]+'))
  ) then raise exception 'Нельзя голосовать за себя.'; end if;
  if v_is_test_account then
    insert into flare_test_votes(account_id,nomination_id,option_id,updated_at) values(v_account,p_nomination_id,p_option_id,now()) on conflict(account_id,nomination_id) do update set option_id=excluded.option_id,updated_at=now();
  else
    insert into flare_votes(account_id,nomination_id,option_id,updated_at) values(v_account,p_nomination_id,p_option_id,now()) on conflict(account_id,nomination_id) do update set option_id=excluded.option_id,updated_at=now();
  end if;
  return jsonb_build_object('ok',true,'test_vote',v_is_test_account);
end $$;

-- Public endpoint reveals aggregate winners only from 6 December 2026; it never returns voter identities.
create or replace function public.get_public_winners() returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare v_winners jsonb;
begin
  if now()<timestamptz '2026-12-06 00:00:00+03' then return jsonb_build_object('published',false,'winners','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('nomination_id',n.id,'title',n.title,'category',n.category,'winners',coalesce(w.winners,'[]'::jsonb)) order by case n.category when 'основная' then 0 else 1 end,n.title),'[]'::jsonb)
  into v_winners
  from public.flare_nominations n
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',ranked.id,'name',ranked.name,'kind',ranked.kind,'votes',ranked.vote_count) order by ranked.name) as winners
    from (
      select o.id,o.name,o.kind,count(v.account_id)::integer as vote_count
      from public.flare_options o
      left join public.flare_votes v on v.nomination_id=o.nomination_id and v.option_id=o.id
      where o.nomination_id=n.id
      group by o.id,o.name,o.kind
    ) ranked
    where ranked.vote_count=(select max(tally.vote_count) from (select count(*)::integer as vote_count from public.flare_votes where nomination_id=n.id group by option_id) tally)
  ) w on true;
  return jsonb_build_object('published',true,'winners',v_winners);
end $$;

create or replace function public.save_event_choice(p_token text,p_choice_id text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_is_test_account boolean:=false; v_event_results jsonb;
begin
  perform flare_assert_account_access(v_account);
  if flare_closed() then raise exception 'Голосование завершено.'; end if;
  if p_choice_id not in ('dec-4','dec-5','dec-6') then raise exception 'Выбери один из предложенных дней.'; end if;
  select is_test_account into v_is_test_account from flare_accounts where id=v_account;
  if v_is_test_account then
    insert into flare_test_event_choices(account_id,choice_id,updated_at) values(v_account,p_choice_id,now()) on conflict(account_id) do update set choice_id=excluded.choice_id,updated_at=now();
  else
    insert into flare_event_choices(account_id,choice_id,updated_at) values(v_account,p_choice_id,now()) on conflict(account_id) do update set choice_id=excluded.choice_id,updated_at=now();
  end if;
  select jsonb_build_object('total',coalesce(sum(votes),0),'counts',coalesce(jsonb_object_agg(choice_id,votes),'{}'::jsonb)) into v_event_results
  from (select choice_id,count(*)::integer as votes from flare_event_choices group by choice_id) poll_counts;
  return jsonb_build_object('ok',true,'event_results',v_event_results,'test_vote',v_is_test_account);
end $$;

-- After voting closes, expose only the leading ceremony date(s), never poll participants.
create or replace function public.get_event_poll_winner() returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare v_choice_ids jsonb;
begin
  if not flare_closed() then return jsonb_build_object('closed',false,'choice_ids','[]'::jsonb); end if;
  with tallies as (
    select choice_id,count(*)::integer as vote_count from public.flare_event_choices group by choice_id
  ), leaders as (
    select choice_id from tallies where vote_count=(select max(vote_count) from tallies)
  )
  select coalesce(jsonb_agg(choice_id order by choice_id),'[]'::jsonb)
  into v_choice_ids from leaders;
  return jsonb_build_object('closed',true,'choice_ids',v_choice_ids);
end $$;

create or replace function public.finalize_ballot(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_required integer; v_done integer; v_is_test_account boolean:=false;
begin
  perform flare_assert_account_access(v_account);
  if flare_closed() then raise exception 'Голосование завершено.'; end if;
  select is_test_account into v_is_test_account from flare_accounts where id=v_account;
  select count(*) into v_required from flare_nominations;
  if v_is_test_account then
    select count(*) into v_done from flare_test_votes where account_id=v_account;
  else
    select count(*) into v_done from flare_votes where account_id=v_account;
  end if;
  if v_done<>v_required then raise exception 'Заполни все номинации: сейчас % из %.',v_done,v_required; end if;
  update flare_accounts set ballot_submitted_at=coalesce(ballot_submitted_at,now()) where id=v_account;
  return jsonb_build_object('ok',true,'test_ballot',v_is_test_account);
end $$;

create or replace function public.admin_summary(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_votes jsonb;
  v_choices jsonb;
  v_test_ballot jsonb;
  v_registered jsonb;
  v_voted jsonb;
  v_not_voted jsonb;
  v_partially_voted jsonb;
  v_registered_count bigint;
  v_voted_count bigint;
  v_total_votes bigint;
  v_required integer;
  v_accounts_closed boolean:=false;
begin
  if not exists(select 1 from flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  select coalesce(accounts_closed,false) into v_accounts_closed from flare_access_settings where singleton;
  select coalesce(jsonb_agg(jsonb_build_object('nomination_title',n.title,'option_name',o.name,'nickname',a.nickname) order by n.title,a.nickname),'[]'::jsonb) into v_votes from flare_votes v join flare_accounts a on a.id=v.account_id and not a.is_test_account join flare_nominations n on n.id=v.nomination_id join flare_options o on o.id=v.option_id;
  select coalesce(jsonb_agg(jsonb_build_object('nickname',a.nickname,'choice_label',case c.choice_id when 'dec-4' then '4 декабря · пятница' when 'dec-5' then '5 декабря · суббота' else '6 декабря · воскресенье' end) order by a.nickname),'[]'::jsonb) into v_choices from flare_event_choices c join flare_accounts a on a.id=c.account_id and not a.is_test_account;
  select jsonb_build_object(
    'exists',exists(select 1 from flare_accounts where nickname='FLARE_TESTER' and is_test_account),
    'submitted',coalesce((select ballot_submitted_at is not null from flare_accounts where nickname='FLARE_TESTER' and is_test_account),false),
    'votes',coalesce((select jsonb_agg(jsonb_build_object('nomination_id',n.id,'nomination_title',n.title,'option_id',o.id,'option_name',o.name) order by case n.category when 'основная' then 0 else 1 end,n.title) from flare_test_votes tv join flare_accounts ta on ta.id=tv.account_id and ta.nickname='FLARE_TESTER' and ta.is_test_account join flare_nominations n on n.id=tv.nomination_id join flare_options o on o.id=tv.option_id),'[]'::jsonb),
    'event_choice',(select choice_id from flare_test_event_choices c join flare_accounts a on a.id=c.account_id where a.nickname='FLARE_TESTER' and a.is_test_account)
  ) into v_test_ballot;
  select count(*) into v_registered_count from flare_accounts where not is_test_account;
  select count(*) into v_required from flare_nominations;
  select count(distinct account_id),count(*) into v_voted_count,v_total_votes from flare_votes;
  select coalesce(jsonb_agg(a.nickname order by a.nickname),'[]'::jsonb) into v_registered from flare_accounts a where not a.is_test_account;
  select coalesce(jsonb_agg(a.nickname order by a.nickname),'[]'::jsonb) into v_voted
  from flare_accounts a where not a.is_test_account and v_required>0 and (select count(*) from flare_votes v where v.account_id=a.id)>=v_required;
  select coalesce(jsonb_agg(jsonb_build_object('nickname',a.nickname,'vote_count',vote_counts.vote_count) order by a.nickname),'[]'::jsonb) into v_partially_voted
  from flare_accounts a join (select account_id,count(*)::integer as vote_count from flare_votes group by account_id) vote_counts on vote_counts.account_id=a.id
  where not a.is_test_account and vote_counts.vote_count>0 and vote_counts.vote_count<v_required;
  select coalesce(jsonb_agg(m.nickname order by m.nickname),'[]'::jsonb) into v_not_voted from flare_members m where m.nickname<>'FLARE_TESTER' and not exists(select 1 from flare_accounts a join flare_votes v on v.account_id=a.id where a.nickname=m.nickname);
  return jsonb_build_object(
    'votes',v_votes,
    'test_ballot',v_test_ballot,
    'event_preferences',v_choices,
    'accounts_closed',v_accounts_closed,
    'statistics',jsonb_build_object(
      'registered_count',v_registered_count,
      'registered_nicknames',v_registered,
      'voted_count',v_voted_count,
      'total_votes',v_total_votes,
      'total_nominations',v_required,
      'voted_nicknames',v_voted,
      'partially_voted_nicknames',v_partially_voted,
      'not_voted_nicknames',v_not_voted
    )
  );
end $$;

create or replace function public.admin_set_accounts_closed(p_token text,p_closed boolean) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_closed boolean;
begin
  if not exists(select 1 from flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  update flare_access_settings set accounts_closed=coalesce(p_closed,false) where singleton returning accounts_closed into v_closed;
  return jsonb_build_object('accounts_closed',coalesce(v_closed,false));
end $$;

create or replace function public.admin_rotate_test_credentials(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_test_account uuid;
  v_email text:='flare-tester-'||encode(extensions.gen_random_bytes(8),'hex')||'@example.invalid';
  v_pin text:=encode(extensions.gen_random_bytes(9),'hex');
begin
  if not exists(select 1 from flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  perform pg_advisory_xact_lock(hashtext('flare-test-account-rotate'));
  insert into flare_accounts(nickname,pin_hash,is_test_account,ballot_submitted_at)
    values('FLARE_TESTER',extensions.crypt(v_pin,extensions.gen_salt('bf',12)),true,null)
    on conflict(nickname) do update set pin_hash=excluded.pin_hash,is_test_account=true,ballot_submitted_at=null
    returning id into v_test_account;
  delete from flare_sessions where account_id=v_test_account;
  delete from flare_votes where account_id=v_test_account;
  delete from flare_event_choices where account_id=v_test_account;
  delete from flare_test_votes where account_id=v_test_account;
  delete from flare_test_event_choices where account_id=v_test_account;
  delete from flare_authorized_emails where expected_nickname='FLARE_TESTER';
  insert into flare_authorized_emails(email,expected_nickname,account_id,is_test_account)
    values(v_email,'FLARE_TESTER',v_test_account,true);
  return jsonb_build_object('email',v_email,'pin',v_pin,'nickname','FLARE_TESTER');
end $$;

create or replace function public.get_clip_options() returns jsonb language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'video_url',video_url) order by id),'[]'::jsonb)
  from flare_options where nomination_id='clip-of-year' and kind='video';
$$;

create or replace function public.admin_update_clip_option(p_token text,p_option_id text,p_name text,p_video_url text default null) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_name text:=trim(coalesce(p_name,''));
  v_video_url text:=nullif(trim(coalesce(p_video_url,'')),'');
  v_saved public.flare_options%rowtype;
begin
  if not exists(select 1 from flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  if p_option_id is null or not exists(select 1 from flare_options where id=p_option_id and nomination_id='clip-of-year' and kind='video') then raise exception 'Можно редактировать только номинантов «КЛИП ГОДА».'; end if;
  if v_name='' or length(v_name)>120 then raise exception 'Название должно содержать от 1 до 120 символов.'; end if;
  if v_video_url is not null and v_video_url !~* '^https?://[^[:space:]]+$' then raise exception 'Ссылка должна начинаться с http:// или https://.'; end if;
  update flare_options set name=v_name,video_url=v_video_url where id=p_option_id and nomination_id='clip-of-year' returning * into v_saved;
  update flare_options set hidden_for_testers=lower(trim(name))<>lower('Qusti въебал все коины') where nomination_id='clip-of-year';
  return jsonb_build_object('id',v_saved.id,'name',v_saved.name,'video_url',v_saved.video_url);
end $$;

create or replace function public.get_video_options() returns jsonb language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nomination_id',nomination_id,'name',name,'video_url',video_url) order by nomination_id,id),'[]'::jsonb)
  from flare_options where kind='video';
$$;

create or replace function public.admin_update_video_option(p_token text,p_option_id text,p_name text,p_video_url text default null) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_name text:=trim(coalesce(p_name,''));
  v_video_url text:=nullif(trim(coalesce(p_video_url,'')),'');
  v_saved public.flare_options%rowtype;
begin
  if not exists(select 1 from flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  if p_option_id is null or not exists(select 1 from flare_options where id=p_option_id and kind='video') then raise exception 'Можно редактировать только номинантов с типом «Видео».'; end if;
  if v_name='' or length(v_name)>120 then raise exception 'Название должно содержать от 1 до 120 символов.'; end if;
  if v_video_url is not null and v_video_url !~* '^https?://[^[:space:]]+$' then raise exception 'Ссылка должна начинаться с http:// или https://.'; end if;
  update flare_options set name=v_name,video_url=v_video_url where id=p_option_id and kind='video' returning * into v_saved;
  return jsonb_build_object('id',v_saved.id,'nomination_id',v_saved.nomination_id,'name',v_saved.name,'video_url',v_saved.video_url);
end $$;

revoke all on function public.flare_closed() from public,anon,authenticated;
revoke all on function public.flare_assert_account_access(uuid) from public,anon,authenticated;
revoke all on function public.flare_new_session(uuid) from public,anon,authenticated;
revoke all on function public.flare_session_account(text) from public,anon,authenticated;
revoke all on function public.flare_access(text,text) from public,authenticated;
revoke all on function public.flare_access(text,text) from anon;
revoke all on function public.flare_logout(text) from public,authenticated;

revoke all on function public.get_my_ballot(text) from public,authenticated;
revoke all on function public.get_my_nominee_view(text) from public,authenticated;
revoke all on function public.set_my_nominee_view(text,text) from public,authenticated;
revoke all on function public.cast_vote(text,text,text) from public,authenticated;
revoke all on function public.save_event_choice(text,text) from public,authenticated;
revoke all on function public.finalize_ballot(text) from public,authenticated;
revoke all on function public.admin_summary(text) from public,authenticated;
revoke all on function public.admin_set_accounts_closed(text,boolean) from public,authenticated;
revoke all on function public.admin_rotate_test_credentials(text) from public,authenticated;
revoke all on function public.get_public_winners() from public,anon,authenticated;
revoke all on function public.get_event_poll_winner() from public,anon,authenticated;
revoke all on function public.get_clip_options() from public,authenticated;
revoke all on function public.admin_update_clip_option(text,text,text,text) from public,authenticated;
revoke all on function public.get_video_options() from public,authenticated;
revoke all on function public.admin_update_video_option(text,text,text,text) from public,authenticated;
grant execute on function public.flare_access(text,text) to anon;
grant execute on function public.flare_logout(text) to anon;

grant execute on function public.get_my_ballot(text) to anon;
grant execute on function public.get_my_nominee_view(text) to anon;
grant execute on function public.set_my_nominee_view(text,text) to anon;
grant execute on function public.cast_vote(text,text,text) to anon;
grant execute on function public.save_event_choice(text,text) to anon;
grant execute on function public.finalize_ballot(text) to anon;
grant execute on function public.admin_summary(text) to anon;
grant execute on function public.admin_set_accounts_closed(text,boolean) to anon;
grant execute on function public.admin_rotate_test_credentials(text) to anon;
grant execute on function public.get_public_winners() to anon;
grant execute on function public.get_event_poll_winner() to anon;
grant execute on function public.get_clip_options() to anon;
grant execute on function public.admin_update_clip_option(text,text,text,text) to anon;
grant execute on function public.get_video_options() to anon;
grant execute on function public.admin_update_video_option(text,text,text,text) to anon;

INSERT INTO public.flare_nominations (id,title,category,display_type,allow_self) VALUES
('flare-king','FLARE KING','основная','Участник',false),
('game-of-year','ИГРА ГОДА','основная','Картинка',false),
('multigaming','MULTIGAMING ГОДА','основная','Участник',false),
('best-cs','ЛУЧШИЙ CS-УЧАСТНИК','основная','Участник',false),
('best-rematch','ЛУЧШИЙ RM-УЧАСТНИК','основная','Участник',false),
('conflict-of-year','КОНФЛИКТ ГОДА','основная','Картинка',true),
('meme-of-year','ЧЕЛОВЕК-МЕМ ГОДА','основная','Участник',false),
('breakthrough','ПРОРЫВ ГОДА','основная','Участник',false),
('clip-of-year','КЛИП ГОДА','основная','Видео',false),
('vibe-of-year','ВАЙБ ГОДА','основная','Участник',false),
('scam-of-year','КИДАЛОВО ГОДА','основная','Участник',true),
('event-of-year','СОБЫТИЕ ГОДА','основная','Видео',true),
('squad-of-year','КОМПАШКА ГОДА','доп.','Картинка',true),
('style-of-year','СТИЛЬ ГОДА','доп.','Участник',false),
('sos-of-year','С.О.С. ГОДА','доп.','Видео',true),
('aura-of-year','АУРА ГОДА','доп.','Участник',false),
('chatter-of-year','ЧАТТЕР ГОДА','доп.','Участник',false),
('shame-of-year','ПОЗОР ГОДА','доп.','Участник',false)
ON CONFLICT (id) DO UPDATE SET title=excluded.title, category=excluded.category, display_type=excluded.display_type, allow_self=excluded.allow_self;
INSERT INTO public.flare_options AS existing_option (id,nomination_id,name,kind,person_nickname) VALUES
('clip-1','clip-of-year','Qusti въебал все коины','video',NULL) ,
('clip-2','clip-of-year','Клип 02 · скоро','video',NULL) ,
('clip-3','clip-of-year','Клип 03 · скоро','video',NULL) ,
('clip-4','clip-of-year','Клип 04 · скоро','video',NULL) ,
('clip-5','clip-of-year','Клип 05 · скоро','video',NULL) ,
('clip-6','clip-of-year','Клип 06 · скоро','video',NULL) ,
('conflict-1','conflict-of-year','Akirakume, Dony_zq, Nodben vs Maronnix','conflict',NULL) ,
('conflict-2','conflict-of-year','Eozik, Flourin, Maronnix vs Denis_185, Fines Stark','video',NULL) ,
('conflict-3','conflict-of-year','Flourin vs Qusti','conflict',NULL) ,
('conflict-4','conflict-of-year','Izumrudik vs Cloury','video',NULL) ,
('event-1','event-of-year','Akirakume получил права','image',NULL) ,
('event-2','event-of-year','Выживание в Minecraft','video',NULL) ,
('event-3','event-of-year','Ливнули с сервера','image',NULL) ,
('event-4','event-of-year','NJDC-2026','video',NULL) ,
('game-1','game-of-year','Counter-Strike 2','game',NULL) ,
('game-2','game-of-year','MECCHA CHAMELEON','game',NULL) ,
('game-3','game-of-year','Minecraft','game',NULL) ,
('game-4','game-of-year','REMATCH','game',NULL) ,
('game-5','game-of-year','Dub Together','game',NULL) ,
('person-1-akirakume','flare-king','Akirakume','person','Akirakume') ,
('person-1-awal','flare-king','Awal','person','Awal') ,
('person-1-dony-zq','flare-king','Dony_zq','person','Dony_zq') ,
('person-1-eozik','flare-king','Eozik','person','Eozik') ,
('person-1-flourin','flare-king','Flourin','person','Flourin') ,
('person-1-izumrudik','flare-king','Izumrudik','person','Izumrudik') ,
('person-1-maronnix','flare-king','Maronnix','person','Maronnix') ,
('person-1-nodben','flare-king','Nodben','person','Nodben') ,
('person-1-qusti','flare-king','Qusti','person','Qusti') ,
('person-1-rezo1n','flare-king','Rezo1n','person','Rezo1n') ,
('person-10-akirakume','aura-of-year','Akirakume','person','Akirakume') ,
('person-10-awal','aura-of-year','Awal','person','Awal') ,
('person-10-balabol','aura-of-year','Balabol','person','Balabol') ,
('person-10-cloury','aura-of-year','Cloury','person','Cloury') ,
('person-10-dony-zq','aura-of-year','Dony_zq','person','Dony_zq') ,
('person-10-eozik','aura-of-year','Eozik','person','Eozik') ,
('person-10-flourin','aura-of-year','Flourin','person','Flourin') ,
('person-10-izumrudik','aura-of-year','Izumrudik','person','Izumrudik') ,
('person-10-maronnix','aura-of-year','Maronnix','person','Maronnix') ,
('person-10-nodben','aura-of-year','Nodben','person','Nodben') ,
('person-10-qusti','aura-of-year','Qusti','person','Qusti') ,
('person-10-rezo1n','aura-of-year','Rezo1n','person','Rezo1n') ,
('person-11-akirakume','chatter-of-year','Akirakume','person','Akirakume') ,
('person-11-awal','chatter-of-year','Awal','person','Awal') ,
('person-11-dony-zq','chatter-of-year','Dony_zq','person','Dony_zq') ,
('person-11-eozik','chatter-of-year','Eozik','person','Eozik') ,
('person-11-flourin','chatter-of-year','Flourin','person','Flourin') ,
('person-11-izumrudik','chatter-of-year','Izumrudik','person','Izumrudik') ,
('person-11-maronnix','chatter-of-year','Maronnix','person','Maronnix') ,
('person-11-nodben','chatter-of-year','Nodben','person','Nodben') ,
('person-11-qusti','chatter-of-year','Qusti','person','Qusti') ,
('person-11-rezo1n','chatter-of-year','Rezo1n','person','Rezo1n') ,
('person-12-akirakume','shame-of-year','Akirakume','person','Akirakume') ,
('person-12-awal','shame-of-year','Awal','person','Awal') ,
('person-12-balabol','shame-of-year','Balabol','person','Balabol') ,
('person-12-cloury','shame-of-year','Cloury','person','Cloury') ,
('person-12-dony-zq','shame-of-year','Dony_zq','person','Dony_zq') ,
('person-12-eozik','shame-of-year','Eozik','person','Eozik') ,
('person-12-flourin','shame-of-year','Flourin','person','Flourin') ,
('person-12-izumrudik','shame-of-year','Izumrudik','person','Izumrudik') ,
('person-12-maronnix','shame-of-year','Maronnix','person','Maronnix') ,
('person-12-nodben','shame-of-year','Nodben','person','Nodben') ,
('person-12-qusti','shame-of-year','Qusti','person','Qusti') ,
('person-12-rezo1n','shame-of-year','Rezo1n','person','Rezo1n') ,
('person-2-akirakume','multigaming','Akirakume','person','Akirakume') ,
('person-2-awal','multigaming','Awal','person','Awal') ,
('person-2-dony-zq','multigaming','Dony_zq','person','Dony_zq') ,
('person-2-izumrudik','multigaming','Izumrudik','person','Izumrudik') ,
('person-2-maronnix','multigaming','Maronnix','person','Maronnix') ,
('person-3-akirakume','best-cs','Akirakume','person','Akirakume') ,
('person-3-awal','best-cs','Awal','person','Awal') ,
('person-3-balabol','best-cs','Balabol','person','Balabol') ,
('person-3-cloury','best-cs','Cloury','person','Cloury') ,
('person-3-dony-zq','best-cs','Dony_zq','person','Dony_zq') ,
('person-3-eozik','best-cs','Eozik','person','Eozik') ,
('person-3-flourin','best-cs','Flourin','person','Flourin') ,
('person-3-izumrudik','best-cs','Izumrudik','person','Izumrudik') ,
('person-3-maronnix','best-cs','Maronnix','person','Maronnix') ,
('person-3-nodben','best-cs','Nodben','person','Nodben') ,
('person-3-qusti','best-cs','Qusti','person','Qusti') ,
('person-3-rezo1n','best-cs','Rezo1n','person','Rezo1n') ,
('person-4-akirakume','best-rematch','Akirakume','person','Akirakume') ,
('person-4-dony-zq','best-rematch','Dony_zq','person','Dony_zq') ,
('person-4-eozik','best-rematch','Eozik','person','Eozik') ,
('person-4-maronnix','best-rematch','Maronnix','person','Maronnix') ,
('person-4-nodben','best-rematch','Nodben','person','Nodben') ,
('person-4-rezo1n','best-rematch','Rezo1n','person','Rezo1n') ,
('person-5-akirakume','meme-of-year','Akirakume','person','Akirakume') ,
('person-5-awal','meme-of-year','Awal','person','Awal') ,
('person-5-balabol','meme-of-year','Balabol','person','Balabol') ,
('person-5-cloury','meme-of-year','Cloury','person','Cloury') ,
('person-5-dony-zq','meme-of-year','Dony_zq','person','Dony_zq') ,
('person-5-eozik','meme-of-year','Eozik','person','Eozik') ,
('person-5-flourin','meme-of-year','Flourin','person','Flourin') ,
('person-5-izumrudik','meme-of-year','Izumrudik','person','Izumrudik') ,
('person-5-maronnix','meme-of-year','Maronnix','person','Maronnix') ,
('person-5-qusti','meme-of-year','Qusti','person','Qusti') ,
('person-6-awal','breakthrough','Awal','person','Awal') ,
('person-6-balabol','breakthrough','Balabol','person','Balabol') ,
('person-6-izumrudik','breakthrough','Izumrudik','person','Izumrudik') ,
('person-7-akirakume','vibe-of-year','Akirakume','person','Akirakume') ,
('person-7-balabol','vibe-of-year','Balabol','person','Balabol') ,
('person-7-dony-zq','vibe-of-year','Dony_zq','person','Dony_zq') ,
('person-7-eozik','vibe-of-year','Eozik','person','Eozik') ,
('person-7-flourin','vibe-of-year','Flourin','person','Flourin') ,
('person-7-izumrudik','vibe-of-year','Izumrudik','person','Izumrudik') ,
('person-7-maronnix','vibe-of-year','Maronnix','person','Maronnix') ,
('person-7-qusti','vibe-of-year','Qusti','person','Qusti') ,
('person-7-rezo1n','vibe-of-year','Rezo1n','person','Rezo1n') ,
('person-8-akirakume','scam-of-year','Liwersi','person',NULL) ,
('person-8-eozik','scam-of-year','Eozik','person','Eozik') ,
('person-8-nodben','scam-of-year','Nodben','person','Nodben') ,
('person-8-qusti','scam-of-year','Qusti','person','Qusti') ,
('person-9-akirakume','style-of-year','Akirakume','person','Akirakume') ,
('person-9-dony-zq','style-of-year','Dony_zq','person','Dony_zq') ,
('person-9-eozik','style-of-year','Eozik','person','Eozik') ,
('person-9-flourin','style-of-year','Flourin','person','Flourin') ,
('person-9-izumrudik','style-of-year','Izumrudik','person','Izumrudik') ,
('person-9-maronnix','style-of-year','Maronnix','person','Maronnix') ,
('person-9-nodben','style-of-year','Nodben','person','Nodben') ,
('person-9-qusti','style-of-year','Qusti','person','Qusti') ,
('scam-group','scam-of-year','Akirakume, Dony_zq и Nodben','group',NULL) ,
('sos-1','sos-of-year','Камбэк CYBERSHOKE летом','video',NULL) ,
('sos-2','sos-of-year','Возвращение на сервер','video',NULL) ,
('sos-3','sos-of-year','Выход GTA VI','video',NULL) ,
('sos-4','sos-of-year','Починил инет Nodben','image',NULL) ,
('sos-5','sos-of-year','Сезон с Blue Lock в REMATCH','video',NULL) ,
('squad-1','squad-of-year','Akirakume, Dony_zq, Nodben','group',NULL) ,
('squad-2','squad-of-year','Eozik, Flourin, Maronnix','group',NULL) ,
('squad-3','squad-of-year','Akirakume, Dony_zq, Maronnix, Nodben','group',NULL) ,
('squad-4','squad-of-year','Akirakume, Awal, Dony_zq, Maronnix, Rezo1n','group',NULL) ,
('squad-5','squad-of-year','Dony_zq, Maronnix, Rezo1n','group',NULL)
ON CONFLICT (id) DO UPDATE SET nomination_id=excluded.nomination_id, name=case when excluded.nomination_id='clip-of-year' then existing_option.name else excluded.name end, kind=excluded.kind, person_nickname=excluded.person_nickname;

-- Keep the named Qusti clip available in test ballots, while dimming the other clip options.
UPDATE public.flare_options
SET name='Qusti въебал все коины'
WHERE id='clip-1' AND nomination_id='clip-of-year' AND name='Клип 01 · скоро'
  AND NOT EXISTS (SELECT 1 FROM public.flare_options WHERE nomination_id='clip-of-year' AND lower(trim(name))=lower('Qusti въебал все коины'));

UPDATE public.flare_options SET hidden_for_testers=false;
UPDATE public.flare_options
SET hidden_for_testers = CASE
  WHEN nomination_id='clip-of-year' THEN lower(trim(name)) <> lower('Qusti въебал все коины')
  ELSE true
END
WHERE nomination_id='clip-of-year'
   OR id IN ('event-1','event-2','squad-4','squad-5','sos-1','sos-2','sos-5','conflict-1')
   OR name IN ('Akirakume получил права','Выживание в Minecraft','Akirakume, Awal, Dony_zq, Maronnix, Rezo1n','Dony_zq, Maronnix, Rezo1n','Камбэк CYBERSHOKE летом','Возвращение на сервер','Сезон с Blue Lock в REMATCH','Akirakume, Dony_zq, Nodben, Maronnix');

-- FLARE profiles and BOING!. Keep this block in sync with migrations/20261105_profiles_and_boing.sql.
-- FLARE profiles and BOING! — server-owned progress, purchases and badges.
-- Run after the existing FLARE schema. Safe to re-run.
begin;

create table if not exists public.flare_boing_profiles (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  bob_name text not null default 'BOB',
  bob_rename_count integer not null default 0 check (bob_rename_count >= 0),
  coins bigint not null default 0 check (coins >= 0),
  coins_earned bigint not null default 0 check (coins_earned >= 0),
  best_score bigint not null default 0 check (best_score >= 0),
  total_score bigint not null default 0 check (total_score >= 0),
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  click_level integer not null default 0 check (click_level between 0 and 5),
  coin_level integer not null default 0 check (coin_level between 0 and 5),
  selected_frame text not null default 'frame-default',
  selected_accessory text not null default 'accessory-none',
  game_intro_seen boolean not null default false,
  run_id uuid,
  run_score bigint not null default 0 check (run_score >= 0),
  run_clicks bigint not null default 0 check (run_clicks >= 0),
  run_started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.flare_boing_items (
  id text primary key,
  kind text not null check (kind in ('click','coin','frame','accessory','banner','badge')),
  name text not null,
  description text not null,
  base_price bigint not null check (base_price >= 0),
  max_level integer not null default 1 check (max_level > 0),
  sort_order integer not null default 0
);

create table if not exists public.flare_boing_inventory (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  item_id text not null references public.flare_boing_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (account_id,item_id)
);

create table if not exists public.flare_badges (
  id text primary key,
  name text not null,
  description text not null,
  rarity text not null check (rarity in ('special','rare','legendary')),
  sort_order integer not null default 0
);

create table if not exists public.flare_account_badges (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  badge_id text not null references public.flare_badges(id) on delete cascade,
  equipped boolean not null default true,
  earned_at timestamptz not null default now(),
  primary key (account_id,badge_id)
);

create table if not exists public.flare_profile_banners (
  account_id uuid primary key references public.flare_accounts(id) on delete cascade,
  image_data bytea not null,
  updated_at timestamptz not null default now()
);

revoke all on public.flare_boing_profiles,public.flare_boing_items,public.flare_boing_inventory,public.flare_badges,public.flare_account_badges,public.flare_profile_banners from anon,authenticated;
alter table public.flare_boing_profiles enable row level security;
alter table public.flare_boing_items enable row level security;
alter table public.flare_boing_inventory enable row level security;
alter table public.flare_badges enable row level security;
alter table public.flare_account_badges enable row level security;
alter table public.flare_profile_banners enable row level security;

insert into public.flare_boing_items(id,kind,name,description,base_price,max_level,sort_order) values
('click-power','click','POWER CLICK','Больше очков за каждый клик. Всего 5 уровней.',500,5,10),
('coin-boost','coin','COIN BOOST','На 20% больше COINS за каждую цель за уровень.',1500,5,20),
('banner-custom','banner','PHOTO BANNER','Загрузка фотографии для обложки профиля.',7500,1,30),
('frame-gold','frame','GOLD FRAME','Золотая рамка вокруг аватара.',2500,1,40),
('frame-aurora','frame','AURORA FRAME','Переливающаяся рамка вокруг аватара.',12000,1,50),
('frame-inferno','frame','INFERNO FRAME','Огненная рамка вокруг аватара.',25000,1,60),
('bob-shades','accessory','BOB SHADES','Минималистичные тёмные очки для BOB.',1500,1,70),
('bob-cap','accessory','BOB CAP','Маленькая кепка для BOB.',3500,1,80),
('bob-crown','accessory','BOB CROWN','Корона для настоящего чемпиона.',8000,1,90),
('legend','badge','LEGEND BADGE','Очень редкий бейдж для профиля.',1000000,1,100)
on conflict(id) do update set kind=excluded.kind,name=excluded.name,description=excluded.description,base_price=excluded.base_price,max_level=excluded.max_level,sort_order=excluded.sort_order;

insert into public.flare_badges(id,name,description,rarity,sort_order) values
('tester','TESTER','За помощь в тестировании FLARE.','special',10),
('creator','CREATOR','Создатель премии FLARE.','special',20),
('boing-10k','BOING 10K','Рекорд BOING! — не меньше 10 000 очков.','rare',30),
('boing-100k','BOING 100K','Рекорд BOING! — не меньше 100 000 очков.','legendary',40),
('legend','LEGEND','Легендарный бейдж из магазина BOING!.','legendary',50)
on conflict(id) do update set name=excluded.name,description=excluded.description,rarity=excluded.rarity,sort_order=excluded.sort_order;

create or replace function public.flare_ensure_boing_profile(p_account uuid)
returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  insert into public.flare_boing_profiles(account_id) values(p_account) on conflict(account_id) do nothing;
  insert into public.flare_account_badges(account_id,badge_id,equipped)
  select a.id,b.id,true from public.flare_accounts a
  join public.flare_badges b on (a.nickname='Eozik' and b.id='tester') or (a.nickname='Maronnix' and b.id='creator')
  where a.id=p_account on conflict(account_id,badge_id) do nothing;
end $$;

create or replace function public.flare_grant_boing_badge(p_account uuid,p_badge text)
returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  insert into public.flare_account_badges(account_id,badge_id,equipped)
  values(p_account,p_badge,true) on conflict(account_id,badge_id) do nothing;
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
    from public.flare_boing_items i
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'kind',kind,'name',name,'description',description,'level',level,'max_level',max_level,
    'owned',level>0,'sold_out',level>=max_level,'price',case when kind in ('click','coin') then base_price*(level+1) else base_price end
  ) order by sort_order,id),'[]'::jsonb) into v_shop from levels;
  return jsonb_build_object(
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
    'coin_multiplier',1+v_profile.coin_level*.2,
    'selected_frame',v_profile.selected_frame,
    'selected_accessory',v_profile.selected_accessory,
    'game_intro_seen',v_profile.game_intro_seen,
    'active_run',case when v_profile.run_id is null then null else jsonb_build_object('id',v_profile.run_id,'score',v_profile.run_score,'clicks',v_profile.run_clicks) end,
    'inventory',v_inventory,
    'badges',v_badges,
    'shop',v_shop
  );
end $$;

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
  return jsonb_build_object(
    'nickname',v_nickname,
    'created_at',v_created,
    'email_masked',case when v_email is null then 'Email не привязан' else left(split_part(v_email,'@',1),1)||'•••••@'||split_part(v_email,'@',2) end,
    'votes_done',coalesce(v_votes,0),
    'total_nominations',v_total,
    'event_answered',v_event_answered,
    'days_with_flare',greatest(0,floor(extract(epoch from now()-v_created)/86400)::integer),
    'banner',v_banner,
    'boing',public.flare_boing_state(v_account)
  );
end $$;

create or replace function public.reveal_my_email(p_token text)
returns text language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_email text;
begin
  perform public.flare_assert_account_access(v_account);
  select email into v_email from public.flare_authorized_emails where account_id=v_account order by created_at,email limit 1;
  if v_email is null then raise exception 'К аккаунту не привязан email.'; end if;
  return v_email;
end $$;

create or replace function public.set_my_profile_banner(p_token text,p_data text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_data bytea;
  v_base64 text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if not exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id='banner-custom') then
    raise exception 'Сначала купи PHOTO BANNER в магазине.';
  end if;
  if p_data is null then
    delete from public.flare_profile_banners where account_id=v_account;
    return jsonb_build_object('ok',true);
  end if;
  if length(p_data)>700000 or p_data !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Нужна JPEG-фотография размером до 500 КБ.';
  end if;
  v_base64:=substring(p_data from 'base64,(.*)$');
  v_data:=pg_catalog.decode(v_base64,'base64');
  if octet_length(v_data)<4 or octet_length(v_data)>500000 or pg_catalog.get_byte(v_data,0)<>255 or pg_catalog.get_byte(v_data,1)<>216 or pg_catalog.get_byte(v_data,octet_length(v_data)-2)<>255 or pg_catalog.get_byte(v_data,octet_length(v_data)-1)<>217 then
    raise exception 'Файл не является корректной JPEG-фотографией.';
  end if;
  insert into public.flare_profile_banners(account_id,image_data,updated_at) values(v_account,v_data,now())
  on conflict(account_id) do update set image_data=excluded.image_data,updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.rename_boing_bob(p_token text,p_name text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=public.flare_session_account(p_token);
  v_profile public.flare_boing_profiles%rowtype;
  v_name text:=regexp_replace(trim(coalesce(p_name,'')),'[[:space:]]+',' ','g');
  v_price integer;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  select * into v_profile from public.flare_boing_profiles where account_id=v_account for update;
  if char_length(v_name)<1 or char_length(v_name)>16 or v_name !~ '^[A-Za-z0-9А-Яа-яЁё _-]+$' then
    raise exception 'Имя BOB: 1–16 букв, цифр, пробелов, дефисов или подчёркиваний.';
  end if;
  if v_name=v_profile.bob_name then raise exception 'Это имя уже используется.'; end if;
  v_price:=case when v_profile.bob_rename_count<2 then 0 else 10000 end;
  if v_profile.coins<v_price then raise exception 'Нужно % COINS для переименования.',v_price; end if;
  update public.flare_boing_profiles set bob_name=v_name,bob_rename_count=bob_rename_count+1,coins=coins-v_price,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
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
  v_price:=case when v_item.kind in ('click','coin') then v_item.base_price*(v_level+1) else v_item.base_price end;
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

create or replace function public.equip_boing_item(p_token text,p_item_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_kind text;
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if p_item_id not in ('frame-default','accessory-none') then
    select kind into v_kind from public.flare_boing_items where id=p_item_id and kind in ('frame','accessory');
    if v_kind is null or not exists(select 1 from public.flare_boing_inventory where account_id=v_account and item_id=p_item_id) then
      raise exception 'Этот аксессуар ещё не куплен.';
    end if;
  else
    v_kind:=case when p_item_id='frame-default' then 'frame' else 'accessory' end;
  end if;
  if v_kind='frame' then update public.flare_boing_profiles set selected_frame=p_item_id,updated_at=now() where account_id=v_account;
  else update public.flare_boing_profiles set selected_accessory=p_item_id,updated_at=now() where account_id=v_account; end if;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.set_boing_badge(p_token text,p_badge_id text,p_equipped boolean)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  if not exists(select 1 from public.flare_account_badges where account_id=v_account and badge_id=p_badge_id) then raise exception 'Этот бейдж ещё не получен.'; end if;
  update public.flare_account_badges set equipped=coalesce(p_equipped,false) where account_id=v_account and badge_id=p_badge_id;
  return jsonb_build_object('ok',true,'boing',public.flare_boing_state(v_account));
end $$;

create or replace function public.mark_boing_intro_seen(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token);
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  update public.flare_boing_profiles set game_intro_seen=true,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.start_boing_run(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_run uuid:=gen_random_uuid();
begin
  perform public.flare_assert_account_access(v_account);
  perform public.flare_ensure_boing_profile(v_account);
  update public.flare_boing_profiles set run_id=v_run,run_score=0,run_clicks=0,run_started_at=now(),games_played=games_played+1,updated_at=now() where account_id=v_account;
  return jsonb_build_object('ok',true,'run_id',v_run,'boing',public.flare_boing_state(v_account));
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
  v_milestone bigint;
  v_rate bigint;
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
  for v_milestone in (floor(v_profile.total_score/100)::bigint + 1)..(floor(v_new_total_score/100)::bigint) loop
    v_rate:=case
      when v_milestone*100>100000 then 1000
      when v_milestone*100>50000 then 500
      when v_milestone*100>10000 then 300
      when v_milestone*100>1000 then 150
      else 100
    end;
    v_reward:=v_reward+floor(v_rate*(1+v_profile.coin_level*.2))::bigint;
  end loop;
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

create or replace function public.get_boing_leaders(p_token text,p_sort text default 'score')
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=public.flare_session_account(p_token); v_leaders jsonb;
begin
  perform public.flare_assert_account_access(v_account);
  if p_sort not in ('score','coins') then raise exception 'Неизвестная сортировка.'; end if;
  with players as (
    select a.nickname,p.bob_name,p.best_score,p.coins,p.total_clicks
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

revoke all on function public.flare_ensure_boing_profile(uuid) from public,anon,authenticated;
revoke all on function public.flare_grant_boing_badge(uuid,text) from public,anon,authenticated;
revoke all on function public.flare_boing_state(uuid) from public,anon,authenticated;
revoke all on function public.get_my_profile(text) from public,authenticated;
revoke all on function public.reveal_my_email(text) from public,authenticated;
revoke all on function public.set_my_profile_banner(text,text) from public,authenticated;
revoke all on function public.rename_boing_bob(text,text) from public,authenticated;
revoke all on function public.buy_boing_item(text,text) from public,authenticated;
revoke all on function public.equip_boing_item(text,text) from public,authenticated;
revoke all on function public.set_boing_badge(text,text,boolean) from public,authenticated;
revoke all on function public.mark_boing_intro_seen(text) from public,authenticated;
revoke all on function public.start_boing_run(text) from public,authenticated;
revoke all on function public.sync_boing_run(text,uuid,bigint,boolean) from public,authenticated;
revoke all on function public.get_boing_leaders(text,text) from public,authenticated;

grant execute on function public.get_my_profile(text) to anon;
grant execute on function public.reveal_my_email(text) to anon;
grant execute on function public.set_my_profile_banner(text,text) to anon;
grant execute on function public.rename_boing_bob(text,text) to anon;
grant execute on function public.buy_boing_item(text,text) to anon;
grant execute on function public.equip_boing_item(text,text) to anon;
grant execute on function public.set_boing_badge(text,text,boolean) to anon;
grant execute on function public.mark_boing_intro_seen(text) to anon;
grant execute on function public.start_boing_run(text) to anon;
grant execute on function public.sync_boing_run(text,uuid,bigint,boolean) to anon;
grant execute on function public.get_boing_leaders(text,text) to anon;

insert into public.flare_account_badges(account_id,badge_id,equipped)
select a.id,b.id,true from public.flare_accounts a
join public.flare_badges b on (a.nickname='Eozik' and b.id='tester') or (a.nickname='Maronnix' and b.id='creator')
on conflict(account_id,badge_id) do nothing;

commit;

-- BOB face studio and public profiles. Keep this block in sync with migrations/20261106_bob_faces_public_profiles.sql.
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

-- Treat Izumrudik vs Cloury as a video nominee in the shared catalog.
-- Run after 20261106_profile_unified_appearance.sql. Safe to re-run.
begin;

insert into public.flare_options(id,nomination_id,name,kind,person_nickname) values
('conflict-4','conflict-of-year','Izumrudik vs Cloury','video',null)
on conflict(id) do update set nomination_id=excluded.nomination_id,name=excluded.name,kind=excluded.kind,person_nickname=excluded.person_nickname;

commit;


-- Reputation, automatic achievement badges, and member social profiles (2026-11-06).

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

-- Retire VK social links and allow the organizer to remove the tester account.
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

-- Drop the remaining legacy VK argument and storage.
begin;

-- Remove the legacy VK API and storage without touching the remaining social data.
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
  insert into public.flare_member_socials(nickname,steam_url,discord_image,telegram_image,updated_at)
  values(trim(p_nickname),v_steam,v_discord,v_telegram,now())
  on conflict(nickname) do update set steam_url=excluded.steam_url,discord_image=excluded.discord_image,telegram_image=excluded.telegram_image,updated_at=now();
  return public.flare_member_social_json(trim(p_nickname));
end $$;

drop function if exists public.admin_set_member_social(text,text,text,text,text,text);
alter table public.flare_member_socials drop column if exists vk_url;

revoke all on function public.admin_set_member_social(text,text,text,text,text) from public,authenticated;
grant execute on function public.admin_set_member_social(text,text,text,text,text) to anon;

commit;

-- Accountless Liwersi replaces only the standalone scam nominee; ID and votes stay intact.
-- Replace only the standalone scam-of-year nominee while preserving its ID and votes.
-- Liwersi is intentionally not a flare member and has no account or profile.
begin;

-- Accountless people are valid nominees: a NULL account link must not point
-- to another member or create profile, social and winner-badge associations.
alter table public.flare_options drop constraint if exists flare_options_check;
alter table public.flare_options
  add constraint flare_options_check
  check (kind='person' or (kind<>'person' and person_nickname is null));

insert into public.flare_options(id,nomination_id,name,kind,person_nickname)
values('person-8-akirakume','scam-of-year','Liwersi','person',null)
on conflict(id) do update set
  nomination_id=excluded.nomination_id,
  name=excluded.name,
  kind=excluded.kind,
  person_nickname=excluded.person_nickname;

commit;
