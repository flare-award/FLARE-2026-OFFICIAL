-- FLARE 2026 — Supabase schema, ballot seed, custom email + PIN auth, and protected RPCs.
-- Run the complete file in Supabase Dashboard → SQL Editor as the project owner.
-- Public frontend keys are not secrets. Never expose a service_role key in this project.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.flare_participants (
  nickname text primary key,
  created_at timestamptz not null default now()
);

create unique index if not exists flare_participants_nickname_lower_uq
  on public.flare_participants (lower(btrim(nickname)));

create table if not exists public.flare_nomination_catalog (
  id text primary key,
  title text not null,
  category text not null check (category in ('main', 'extra')),
  allow_self_vote boolean not null default false,
  sort_order integer not null
);

create table if not exists public.flare_nominees (
  id text primary key,
  nomination_id text not null references public.flare_nomination_catalog(id) on delete cascade,
  label text not null,
  person_nickname text,
  sort_order integer not null,
  unique (nomination_id, id)
);

create table if not exists public.flare_accounts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  pin_hash text not null,
  is_admin boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists flare_accounts_nickname_lower_uq
  on public.flare_accounts (lower(btrim(nickname)));

create table if not exists public.flare_emails (
  email text primary key,
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (email = lower(btrim(email)))
);

create index if not exists flare_emails_account_id_idx on public.flare_emails(account_id);

create table if not exists public.flare_sessions (
  token_hash text primary key,
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists flare_sessions_account_id_idx on public.flare_sessions(account_id);
create index if not exists flare_sessions_expiry_idx on public.flare_sessions(expires_at);

create table if not exists public.flare_login_attempts (
  email text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists flare_login_attempts_email_time_idx
  on public.flare_login_attempts(email, attempted_at desc);

create table if not exists public.flare_votes (
  account_id uuid not null references public.flare_accounts(id) on delete cascade,
  nomination_id text not null references public.flare_nomination_catalog(id) on delete cascade,
  nominee_id text not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, nomination_id),
  foreign key (nomination_id, nominee_id)
    references public.flare_nominees(nomination_id, id) on delete restrict
);

create index if not exists flare_votes_nomination_id_idx on public.flare_votes(nomination_id);

-- All participant-facing data and writes go through SECURITY DEFINER RPCs below.
-- RLS remains enabled and there are deliberately no direct table policies.
alter table public.flare_participants enable row level security;
alter table public.flare_nomination_catalog enable row level security;
alter table public.flare_nominees enable row level security;
alter table public.flare_accounts enable row level security;
alter table public.flare_emails enable row level security;
alter table public.flare_sessions enable row level security;
alter table public.flare_login_attempts enable row level security;
alter table public.flare_votes enable row level security;

revoke all on table public.flare_participants from public, anon, authenticated;
revoke all on table public.flare_nomination_catalog from public, anon, authenticated;
revoke all on table public.flare_nominees from public, anon, authenticated;
revoke all on table public.flare_accounts from public, anon, authenticated;
revoke all on table public.flare_emails from public, anon, authenticated;
revoke all on table public.flare_sessions from public, anon, authenticated;
revoke all on table public.flare_login_attempts from public, anon, authenticated;
revoke all on table public.flare_votes from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Private helper. A browser session token is random, shown to its owner only,
-- and stored in the database as a SHA-256 hash.
create or replace function public.flare_session_account_id(p_session_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_account_id uuid;
  v_token_hash text;
begin
  if p_session_token is null or length(p_session_token) < 32 then
    raise exception using errcode = '28000', message = 'Сессия истекла. Войди ещё раз.';
  end if;

  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');
  select s.account_id
    into v_account_id
    from public.flare_sessions as s
   where s.token_hash = v_token_hash
     and s.expires_at > now();

  if v_account_id is null then
    delete from public.flare_sessions
     where token_hash = v_token_hash
       and expires_at <= now();
    raise exception using errcode = '28000', message = 'Сессия истекла. Войди ещё раз.';
  end if;

  return v_account_id;
end;
$$;

create or replace function public.flare_register(p_email text, p_pin text, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_pin text := coalesce(p_pin, '');
  v_nickname text;
  v_account_id uuid;
  v_session_token text;
  v_expires_at timestamptz;
begin
  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception using errcode = '22023', message = 'Укажи корректный email.';
  end if;
  if v_pin !~ '^[A-Za-z0-9]{4,32}$' then
    raise exception using errcode = '22023', message = 'PIN-код должен содержать от 4 до 32 латинских букв или цифр.';
  end if;

  select p.nickname
    into v_nickname
    from public.flare_participants as p
   where lower(p.nickname) = lower(btrim(coalesce(p_nickname, '')));
  if v_nickname is null then
    raise exception using errcode = '22023', message = 'Выбери ник участника из списка.';
  end if;

  if exists (select 1 from public.flare_emails as e where e.email = v_email) then
    raise exception using errcode = 'P0001', message = 'Этот email уже зарегистрирован. Войди в аккаунт или попроси организатора связать адрес с нужным профилем.';
  end if;
  if exists (select 1 from public.flare_accounts as a where lower(btrim(a.nickname)) = lower(btrim(v_nickname))) then
    raise exception using errcode = 'P0001', message = 'Этот ник уже используется. Если это твой профиль, попроси организатора добавить email как дополнительный.';
  end if;

  insert into public.flare_accounts (nickname, pin_hash)
  values (v_nickname, crypt(v_pin, gen_salt('bf', 12)))
  returning id into v_account_id;

  insert into public.flare_emails (email, account_id)
  values (v_email, v_account_id);

  delete from public.flare_sessions where expires_at < now() - interval '7 days';
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '30 days';
  insert into public.flare_sessions (token_hash, account_id, expires_at)
  values (encode(digest(v_session_token, 'sha256'), 'hex'), v_account_id, v_expires_at);

  return jsonb_build_object(
    'sessionToken', v_session_token,
    'nickname', v_nickname,
    'isAdmin', false,
    'expiresAt', v_expires_at
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'Этот email или ник уже используется. Войди в аккаунт или попроси организатора связать email.';
end;
$$;

create or replace function public.flare_login(p_email text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_pin text := coalesce(p_pin, '');
  v_account public.flare_accounts%rowtype;
  v_session_token text;
  v_expires_at timestamptz;
  v_attempts integer;
begin
  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' or v_pin = '' then
    return jsonb_build_object('error', 'Неверный email или PIN. Если ты впервые здесь — создай аккаунт.');
  end if;

  -- Serialise attempts by email, then cap failed PIN guesses at 8 per 15 minutes.
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  delete from public.flare_login_attempts where attempted_at < now() - interval '24 hours';
  select count(*)::integer
    into v_attempts
    from public.flare_login_attempts as a
   where a.email = v_email
     and a.attempted_at > now() - interval '15 minutes';
  if v_attempts >= 8 then
    return jsonb_build_object('error', 'Слишком много попыток входа. Подожди 15 минут и попробуй снова.');
  end if;

  select a.*
    into v_account
    from public.flare_emails as e
    join public.flare_accounts as a on a.id = e.account_id
   where e.email = v_email;

  if not found or crypt(v_pin, v_account.pin_hash) <> v_account.pin_hash then
    insert into public.flare_login_attempts (email) values (v_email);
    return jsonb_build_object('error', 'Неверный email или PIN. Если ты впервые здесь — создай аккаунт.');
  end if;

  delete from public.flare_login_attempts where email = v_email;
  delete from public.flare_sessions where expires_at < now() - interval '7 days';
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '30 days';
  insert into public.flare_sessions (token_hash, account_id, expires_at)
  values (encode(digest(v_session_token, 'sha256'), 'hex'), v_account.id, v_expires_at);

  return jsonb_build_object(
    'sessionToken', v_session_token,
    'nickname', v_account.nickname,
    'isAdmin', v_account.is_admin,
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.flare_logout(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_token_hash text;
begin
  if p_session_token is not null and length(p_session_token) >= 32 then
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');
    delete from public.flare_sessions where token_hash = v_token_hash;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.flare_get_my_votes(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_account_id uuid := public.flare_session_account_id(p_session_token);
  v_result jsonb;
begin
  select jsonb_build_object(
    'nickname', a.nickname,
    'isAdmin', a.is_admin,
    'completedAt', a.completed_at,
    'votes', coalesce(
      jsonb_agg(
        jsonb_build_object('nominationId', v.nomination_id, 'nomineeId', v.nominee_id)
        order by n.sort_order
      ) filter (where v.nomination_id is not null),
      '[]'::jsonb
    )
  )
  into v_result
  from public.flare_accounts as a
  left join public.flare_votes as v on v.account_id = a.id
  left join public.flare_nomination_catalog as n on n.id = v.nomination_id
  where a.id = v_account_id
  group by a.id;

  return coalesce(v_result, jsonb_build_object('votes', '[]'::jsonb, 'completedAt', null));
end;
$$;

create or replace function public.flare_cast_vote(
  p_session_token text,
  p_nomination_id text,
  p_nominee_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_account_id uuid := public.flare_session_account_id(p_session_token);
  v_account_nickname text;
  v_allow_self_vote boolean;
  v_nominee_nickname text;
  v_updated_at timestamptz;
begin
  if now() >= timestamptz '2026-11-22 00:00:00+05:00' then
    raise exception using errcode = 'P0001', message = 'Голосование закрыто. Дедлайн — 21 ноября 2026 года, 23:59 по уральскому времени.';
  end if;

  select a.nickname into v_account_nickname
    from public.flare_accounts as a where a.id = v_account_id;
  select n.allow_self_vote into v_allow_self_vote
    from public.flare_nomination_catalog as n where n.id = p_nomination_id;
  if v_allow_self_vote is null then
    raise exception using errcode = 'P0001', message = 'Номинация не найдена.';
  end if;

  select n.person_nickname into v_nominee_nickname
    from public.flare_nominees as n
   where n.nomination_id = p_nomination_id
     and n.id = p_nominee_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Номинант не найден в этой номинации.';
  end if;

  if not v_allow_self_vote
     and v_nominee_nickname is not null
     and lower(btrim(v_nominee_nickname)) = lower(btrim(v_account_nickname)) then
    raise exception using errcode = 'P0001', message = 'Нельзя голосовать за себя в этой номинации.';
  end if;

  insert into public.flare_votes (account_id, nomination_id, nominee_id, updated_at)
  values (v_account_id, p_nomination_id, p_nominee_id, now())
  on conflict (account_id, nomination_id)
  do update set nominee_id = excluded.nominee_id, updated_at = now()
  returning updated_at into v_updated_at;

  return jsonb_build_object('ok', true, 'updatedAt', v_updated_at);
end;
$$;

create or replace function public.flare_finalize_ballot(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_account_id uuid := public.flare_session_account_id(p_session_token);
  v_required integer;
  v_cast integer;
  v_completed_at timestamptz;
begin
  select count(*)::integer into v_required from public.flare_nomination_catalog;
  select count(distinct v.nomination_id)::integer into v_cast
    from public.flare_votes as v where v.account_id = v_account_id;
  if v_required = 0 or v_cast <> v_required then
    raise exception using errcode = 'P0001', message = 'Заполни все номинации, прежде чем подтверждать бюллетень.';
  end if;

  update public.flare_accounts
     set completed_at = coalesce(completed_at, now())
   where id = v_account_id
   returning completed_at into v_completed_at;

  return jsonb_build_object('completedAt', v_completed_at, 'ballotSize', v_required);
end;
$$;

create or replace function public.flare_admin_results(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_account_id uuid := public.flare_session_account_id(p_session_token);
  v_is_admin boolean;
  v_nickname text;
  v_result jsonb;
begin
  select a.is_admin, a.nickname
    into v_is_admin, v_nickname
    from public.flare_accounts as a where a.id = v_account_id;
  if not coalesce(v_is_admin, false) or lower(btrim(coalesce(v_nickname, ''))) <> 'maronnix' then
    raise exception using errcode = '42501', message = 'Доступ к панели организатора закрыт.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nominationId', n.id,
        'title', n.title,
        'votes', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'voter', a.nickname,
              'nomineeId', nm.id,
              'nominee', nm.label,
              'updatedAt', v.updated_at
            ) order by a.nickname, v.updated_at
          )
          from public.flare_votes as v
          join public.flare_accounts as a on a.id = v.account_id
          join public.flare_nominees as nm on nm.id = v.nominee_id and nm.nomination_id = v.nomination_id
          where v.nomination_id = n.id
        ), '[]'::jsonb)
      ) order by n.sort_order
    ), '[]'::jsonb
  ) into v_result
  from public.flare_nomination_catalog as n;

  return v_result;
end;
$$;

-- Do not let browser roles invoke the helper directly. Public RPC functions are whitelisted below.
revoke all on function public.flare_session_account_id(text) from public, anon, authenticated;
revoke all on function public.flare_register(text, text, text) from public, anon, authenticated;
revoke all on function public.flare_login(text, text) from public, anon, authenticated;
revoke all on function public.flare_logout(text) from public, anon, authenticated;
revoke all on function public.flare_get_my_votes(text) from public, anon, authenticated;
revoke all on function public.flare_cast_vote(text, text, text) from public, anon, authenticated;
revoke all on function public.flare_finalize_ballot(text) from public, anon, authenticated;
revoke all on function public.flare_admin_results(text) from public, anon, authenticated;

grant execute on function public.flare_register(text, text, text) to anon, authenticated;
grant execute on function public.flare_login(text, text) to anon, authenticated;
grant execute on function public.flare_logout(text) to anon, authenticated;
grant execute on function public.flare_get_my_votes(text) to anon, authenticated;
grant execute on function public.flare_cast_vote(text, text, text) to anon, authenticated;
grant execute on function public.flare_finalize_ballot(text) to anon, authenticated;
grant execute on function public.flare_admin_results(text) to anon, authenticated;

-- Seed the participant roster and the exact ballot catalog used by public/data.js.
insert into public.flare_participants (nickname) values
  ('Akirakume'),
  ('Awal'),
  ('Dony_zq'),
  ('Eozik'),
  ('Flourin'),
  ('Izumrudik'),
  ('Maronnix'),
  ('Nodben'),
  ('Qusti'),
  ('Rezo1n'),
  ('Balabol'),
  ('Cloury'),
  ('Denis_185'),
  ('Fines Stark')
on conflict (nickname) do nothing;

insert into public.flare_nomination_catalog (id, title, category, allow_self_vote, sort_order) values
  ('flare-king', 'FLARE KING', 'main', false, 1),
  ('multigaming', 'MULTIGAMING ГОДА', 'main', false, 2),
  ('cs-player', 'ЛУЧШИЙ CS-УЧАСТНИК', 'main', false, 3),
  ('rematch-player', 'ЛУЧШИЙ REMATCH-УЧАСТНИК', 'main', false, 4),
  ('meme-person', 'ЧЕЛОВЕК-МЕМ ГОДА', 'main', false, 5),
  ('breakthrough', 'ПРОРЫВ ГОДА', 'main', false, 6),
  ('vibe', 'ВАЙБ ГОДА', 'main', false, 7),
  ('kidalovo', 'КИДАЛОВО ГОДА', 'main', true, 8),
  ('game-of-year', 'ИГРА ГОДА', 'main', true, 9),
  ('conflict', 'КОНФЛИКТ ГОДА', 'main', true, 10),
  ('clip-of-year', 'КЛИП ГОДА', 'main', true, 11),
  ('event-of-year', 'СОБЫТИЕ ГОДА', 'main', true, 12),
  ('style', 'СТИЛЬ ГОДА', 'extra', false, 13),
  ('aura', 'АУРА ГОДА', 'extra', false, 14),
  ('shame', 'ПОЗОР ГОДА', 'extra', false, 15),
  ('chatter', 'ЧАТТЕР ГОДА', 'extra', false, 16),
  ('squad-of-year', 'КОМПАШКА ГОДА', 'extra', true, 17),
  ('sos', 'С.О.С. ГОДА', 'extra', true, 18)
on conflict (id) do update set title = excluded.title, category = excluded.category, allow_self_vote = excluded.allow_self_vote, sort_order = excluded.sort_order;

insert into public.flare_nominees (id, nomination_id, label, person_nickname, sort_order) values
  ('flare-king-akirakume', 'flare-king', 'Akirakume', 'Akirakume', 1),
  ('flare-king-awal', 'flare-king', 'Awal', 'Awal', 2),
  ('flare-king-dony_zq', 'flare-king', 'Dony_zq', 'Dony_zq', 3),
  ('flare-king-eozik', 'flare-king', 'Eozik', 'Eozik', 4),
  ('flare-king-flourin', 'flare-king', 'Flourin', 'Flourin', 5),
  ('flare-king-izumrudik', 'flare-king', 'Izumrudik', 'Izumrudik', 6),
  ('flare-king-maronnix', 'flare-king', 'Maronnix', 'Maronnix', 7),
  ('flare-king-nodben', 'flare-king', 'Nodben', 'Nodben', 8),
  ('flare-king-qusti', 'flare-king', 'Qusti', 'Qusti', 9),
  ('flare-king-rezo1n', 'flare-king', 'Rezo1n', 'Rezo1n', 10),
  ('multigaming-akirakume', 'multigaming', 'Akirakume', 'Akirakume', 1),
  ('multigaming-awal', 'multigaming', 'Awal', 'Awal', 2),
  ('multigaming-dony_zq', 'multigaming', 'Dony_zq', 'Dony_zq', 3),
  ('multigaming-izumrudik', 'multigaming', 'Izumrudik', 'Izumrudik', 4),
  ('multigaming-maronnix', 'multigaming', 'Maronnix', 'Maronnix', 5),
  ('cs-player-akirakume', 'cs-player', 'Akirakume', 'Akirakume', 1),
  ('cs-player-awal', 'cs-player', 'Awal', 'Awal', 2),
  ('cs-player-balabol', 'cs-player', 'Balabol', 'Balabol', 3),
  ('cs-player-cloury', 'cs-player', 'Cloury', 'Cloury', 4),
  ('cs-player-dony_zq', 'cs-player', 'Dony_zq', 'Dony_zq', 5),
  ('cs-player-eozik', 'cs-player', 'Eozik', 'Eozik', 6),
  ('cs-player-flourin', 'cs-player', 'Flourin', 'Flourin', 7),
  ('cs-player-izumrudik', 'cs-player', 'Izumrudik', 'Izumrudik', 8),
  ('cs-player-maronnix', 'cs-player', 'Maronnix', 'Maronnix', 9),
  ('cs-player-nodben', 'cs-player', 'Nodben', 'Nodben', 10),
  ('cs-player-qusti', 'cs-player', 'Qusti', 'Qusti', 11),
  ('cs-player-rezo1n', 'cs-player', 'Rezo1n', 'Rezo1n', 12),
  ('rematch-player-akirakume', 'rematch-player', 'Akirakume', 'Akirakume', 1),
  ('rematch-player-dony_zq', 'rematch-player', 'Dony_zq', 'Dony_zq', 2),
  ('rematch-player-eozik', 'rematch-player', 'Eozik', 'Eozik', 3),
  ('rematch-player-maronnix', 'rematch-player', 'Maronnix', 'Maronnix', 4),
  ('rematch-player-nodben', 'rematch-player', 'Nodben', 'Nodben', 5),
  ('rematch-player-rezo1n', 'rematch-player', 'Rezo1n', 'Rezo1n', 6),
  ('meme-person-akirakume', 'meme-person', 'Akirakume', 'Akirakume', 1),
  ('meme-person-awal', 'meme-person', 'Awal', 'Awal', 2),
  ('meme-person-balabol', 'meme-person', 'Balabol', 'Balabol', 3),
  ('meme-person-cloury', 'meme-person', 'Cloury', 'Cloury', 4),
  ('meme-person-dony_zq', 'meme-person', 'Dony_zq', 'Dony_zq', 5),
  ('meme-person-eozik', 'meme-person', 'Eozik', 'Eozik', 6),
  ('meme-person-flourin', 'meme-person', 'Flourin', 'Flourin', 7),
  ('meme-person-izumrudik', 'meme-person', 'Izumrudik', 'Izumrudik', 8),
  ('meme-person-maronnix', 'meme-person', 'Maronnix', 'Maronnix', 9),
  ('meme-person-qusti', 'meme-person', 'Qusti', 'Qusti', 10),
  ('breakthrough-awal', 'breakthrough', 'Awal', 'Awal', 1),
  ('breakthrough-balabol', 'breakthrough', 'Balabol', 'Balabol', 2),
  ('breakthrough-izumrudik', 'breakthrough', 'Izumrudik', 'Izumrudik', 3),
  ('vibe-akirakume', 'vibe', 'Akirakume', 'Akirakume', 1),
  ('vibe-balabol', 'vibe', 'Balabol', 'Balabol', 2),
  ('vibe-dony_zq', 'vibe', 'Dony_zq', 'Dony_zq', 3),
  ('vibe-eozik', 'vibe', 'Eozik', 'Eozik', 4),
  ('vibe-flourin', 'vibe', 'Flourin', 'Flourin', 5),
  ('vibe-izumrudik', 'vibe', 'Izumrudik', 'Izumrudik', 6),
  ('vibe-maronnix', 'vibe', 'Maronnix', 'Maronnix', 7),
  ('vibe-qusti', 'vibe', 'Qusti', 'Qusti', 8),
  ('vibe-rezo1n', 'vibe', 'Rezo1n', 'Rezo1n', 9),
  ('kidalovo-nodben', 'kidalovo', 'Nodben', 'Nodben', 1),
  ('kidalovo-qusti', 'kidalovo', 'Qusti', 'Qusti', 2),
  ('kidalovo-akirakume', 'kidalovo', 'Akirakume', 'Akirakume', 3),
  ('kidalovo-group', 'kidalovo', 'Akirakume, Dony_zq и Nodben', null, 4),
  ('game-cs2', 'game-of-year', 'Counter-Strike 2', null, 1),
  ('game-mechcha', 'game-of-year', 'MECCHA CHAMELEON', null, 2),
  ('game-minecraft', 'game-of-year', 'Minecraft', null, 3),
  ('game-rematch', 'game-of-year', 'REMATCH', null, 4),
  ('conflict-akira-maronnix', 'conflict', 'Akirakume, Dony_zq, Nodben vs Maronnix', null, 1),
  ('conflict-eozik-denis', 'conflict', 'Eozik, Flourin, Maronnix vs Denis_185, Fines Stark', null, 2),
  ('conflict-flourin-qusti', 'conflict', 'Flourin vs Qusti', null, 3),
  ('clip-01', 'clip-of-year', 'Клип №01', null, 1),
  ('clip-02', 'clip-of-year', 'Клип №02', null, 2),
  ('clip-03', 'clip-of-year', 'Клип №03', null, 3),
  ('clip-04', 'clip-of-year', 'Клип №04', null, 4),
  ('clip-05', 'clip-of-year', 'Клип №05', null, 5),
  ('clip-06', 'clip-of-year', 'Клип №06', null, 6),
  ('event-akirakume-rights', 'event-of-year', 'Akirakume получил права', null, 1),
  ('event-minecraft-survival', 'event-of-year', 'Выживание в Minecraft', null, 2),
  ('event-left-server', 'event-of-year', 'Ливнули с сервера', null, 3),
  ('event-njdc', 'event-of-year', 'NJDC-2026', null, 4),
  ('style-akirakume', 'style', 'Akirakume', 'Akirakume', 1),
  ('style-dony_zq', 'style', 'Dony_zq', 'Dony_zq', 2),
  ('style-eozik', 'style', 'Eozik', 'Eozik', 3),
  ('style-flourin', 'style', 'Flourin', 'Flourin', 4),
  ('style-izumrudik', 'style', 'Izumrudik', 'Izumrudik', 5),
  ('style-maronnix', 'style', 'Maronnix', 'Maronnix', 6),
  ('style-nodben', 'style', 'Nodben', 'Nodben', 7),
  ('style-qusti', 'style', 'Qusti', 'Qusti', 8),
  ('aura-akirakume', 'aura', 'Akirakume', 'Akirakume', 1),
  ('aura-awal', 'aura', 'Awal', 'Awal', 2),
  ('aura-balabol', 'aura', 'Balabol', 'Balabol', 3),
  ('aura-cloury', 'aura', 'Cloury', 'Cloury', 4),
  ('aura-dony_zq', 'aura', 'Dony_zq', 'Dony_zq', 5),
  ('aura-eozik', 'aura', 'Eozik', 'Eozik', 6),
  ('aura-flourin', 'aura', 'Flourin', 'Flourin', 7),
  ('aura-izumrudik', 'aura', 'Izumrudik', 'Izumrudik', 8),
  ('aura-maronnix', 'aura', 'Maronnix', 'Maronnix', 9),
  ('aura-nodben', 'aura', 'Nodben', 'Nodben', 10),
  ('aura-qusti', 'aura', 'Qusti', 'Qusti', 11),
  ('aura-rezo1n', 'aura', 'Rezo1n', 'Rezo1n', 12),
  ('shame-akirakume', 'shame', 'Akirakume', 'Akirakume', 1),
  ('shame-awal', 'shame', 'Awal', 'Awal', 2),
  ('shame-balabol', 'shame', 'Balabol', 'Balabol', 3),
  ('shame-cloury', 'shame', 'Cloury', 'Cloury', 4),
  ('shame-dony_zq', 'shame', 'Dony_zq', 'Dony_zq', 5),
  ('shame-eozik', 'shame', 'Eozik', 'Eozik', 6),
  ('shame-flourin', 'shame', 'Flourin', 'Flourin', 7),
  ('shame-izumrudik', 'shame', 'Izumrudik', 'Izumrudik', 8),
  ('shame-maronnix', 'shame', 'Maronnix', 'Maronnix', 9),
  ('shame-nodben', 'shame', 'Nodben', 'Nodben', 10),
  ('shame-qusti', 'shame', 'Qusti', 'Qusti', 11),
  ('shame-rezo1n', 'shame', 'Rezo1n', 'Rezo1n', 12),
  ('chatter-akirakume', 'chatter', 'Akirakume', 'Akirakume', 1),
  ('chatter-awal', 'chatter', 'Awal', 'Awal', 2),
  ('chatter-dony_zq', 'chatter', 'Dony_zq', 'Dony_zq', 3),
  ('chatter-eozik', 'chatter', 'Eozik', 'Eozik', 4),
  ('chatter-flourin', 'chatter', 'Flourin', 'Flourin', 5),
  ('chatter-izumrudik', 'chatter', 'Izumrudik', 'Izumrudik', 6),
  ('chatter-maronnix', 'chatter', 'Maronnix', 'Maronnix', 7),
  ('chatter-nodben', 'chatter', 'Nodben', 'Nodben', 8),
  ('chatter-qusti', 'chatter', 'Qusti', 'Qusti', 9),
  ('chatter-rezo1n', 'chatter', 'Rezo1n', 'Rezo1n', 10),
  ('squad-akira-dony-nodben', 'squad-of-year', 'Akirakume, Dony_zq, Nodben', null, 1),
  ('squad-eozik-flourin-maronnix', 'squad-of-year', 'Eozik, Flourin, Maronnix', null, 2),
  ('squad-five-friends', 'squad-of-year', 'Akirakume, Dony_zq, Maronnix, Nodben, Qusti', null, 3),
  ('squad-akira-rezoin', 'squad-of-year', 'Akirakume, Dony_zq, Maronnix, Rezo1n', null, 4),
  ('sos-cybershoke', 'sos', 'Камбэк CYBERSHOKE летом', null, 1),
  ('sos-return-server', 'sos', 'Возвращение на сервер', null, 2),
  ('sos-gta-vi', 'sos', 'Выход GTA VI', null, 3),
  ('sos-nodben-internet', 'sos', 'Починили инет Nodben', null, 4)
on conflict (id) do update set nomination_id = excluded.nomination_id, label = excluded.label, person_nickname = excluded.person_nickname, sort_order = excluded.sort_order;

commit;
