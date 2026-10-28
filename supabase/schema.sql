-- FLARE 2026 secure custom email + PIN backend for Supabase.
-- Run in Supabase SQL Editor as project owner. Never expose service_role keys to the browser.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.flare_members (
  nickname text primary key,
  constraint flare_members_nickname_known check (nickname in ('Akirakume','Awal','Balabol','Cloury','Dony_zq','Eozik','Flourin','Izumrudik','Maronnix','Nodben','Qusti','Rezo1n'))
);
insert into public.flare_members(nickname) values
('Akirakume'),('Awal'),('Balabol'),('Cloury'),('Dony_zq'),('Eozik'),('Flourin'),('Izumrudik'),('Maronnix'),('Nodben'),('Qusti'),('Rezo1n') on conflict do nothing;

-- Organizers pre-authorize email addresses here. First registration attaches the email to a member.
-- Keep the email list in Supabase, not in public GitHub files.
create table if not exists public.flare_authorized_emails (
  email text primary key check (email = lower(trim(email))),
  expected_nickname text not null references public.flare_members(nickname),
  account_id uuid null,
  created_at timestamptz not null default now()
);
create table if not exists public.flare_accounts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique references public.flare_members(nickname),
  pin_hash text not null,
  ballot_submitted_at timestamptz,
  created_at timestamptz not null default now()
);
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
  check ((kind='person' and person_nickname is not null) or (kind<>'person' and person_nickname is null))
);
alter table public.flare_options add column if not exists video_url text;
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

REVOKE ALL ON public.flare_members, public.flare_authorized_emails, public.flare_accounts, public.flare_sessions, public.flare_login_attempts, public.flare_nominations, public.flare_options, public.flare_votes, public.flare_event_choices FROM anon, authenticated;
ALTER TABLE public.flare_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flare_event_choices ENABLE ROW LEVEL SECURITY;

create or replace function public.flare_closed() returns boolean language sql stable as $$
  select now() >= timestamptz '2026-11-22 00:00:00+03'
$$;
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

  select expected_nickname,account_id into v_expected,v_linked
    from flare_authorized_emails where email=v_email for update;
  v_allowed:=found and v_expected is not null;

  if v_allowed then
    perform pg_advisory_xact_lock(hashtext('member:'||v_expected));
    select id,nickname,pin_hash into v_account,v_nickname,v_pin_hash
      from flare_accounts where nickname=v_expected for update;
    if found then
      if (v_linked is not null and v_linked<>v_account)
         or extensions.crypt(p_pin,v_pin_hash) is distinct from v_pin_hash then
        v_allowed:=false;
      end if;
    else
      if v_linked is not null then
        v_allowed:=false;
      else
        v_create:=true;
      end if;
    end if;
  end if;

  if v_allowed then
    if v_create then
      insert into flare_accounts(nickname,pin_hash)
        values(v_expected,extensions.crypt(p_pin,extensions.gen_salt('bf',12)))
        returning id,nickname into v_account,v_nickname;
    end if;
    -- Every organizer-authorized alias for this member becomes the same account.
    update flare_authorized_emails set account_id=v_account
      where expected_nickname=v_expected and (account_id is null or account_id=v_account);
    delete from flare_login_attempts where email=v_email;
    v_token:=flare_new_session(v_account);
    return jsonb_build_object('token',v_token,'nickname',v_nickname,
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
declare v_account uuid:=flare_session_account(p_token); v_votes jsonb; v_event_choice text; v_event_results jsonb;
begin
  select coalesce(jsonb_object_agg(nomination_id,option_id),'{}'::jsonb) into v_votes from flare_votes where account_id=v_account;
  select choice_id into v_event_choice from flare_event_choices where account_id=v_account;
  if v_event_choice is not null then
    select jsonb_build_object('total',coalesce(sum(votes),0),'counts',coalesce(jsonb_object_agg(choice_id,votes),'{}'::jsonb)) into v_event_results
    from (select choice_id,count(*)::integer as votes from flare_event_choices group by choice_id) poll_counts;
  end if;
  return jsonb_build_object('votes',v_votes,'event_choice',v_event_choice,'event_results',v_event_results,'ballot_submitted',(select ballot_submitted_at is not null from flare_accounts where id=v_account));
end $$;

create or replace function public.cast_vote(p_token text,p_nomination_id text,p_option_id text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_nickname text;
begin
  if flare_closed() then raise exception 'Голосование завершено. Голоса больше нельзя изменить.'; end if;
  select nickname into v_nickname from flare_accounts where id=v_account;
  if not exists(select 1 from flare_options o join flare_nominations n on n.id=o.nomination_id where o.id=p_option_id and o.nomination_id=p_nomination_id) then raise exception 'Такого номинанта нет.'; end if;
  if exists(select 1 from flare_options o join flare_nominations n on n.id=o.nomination_id where o.id=p_option_id and o.nomination_id=p_nomination_id and o.kind='person' and o.person_nickname=v_nickname and not n.allow_self) then raise exception 'Нельзя голосовать за себя.'; end if;
  insert into flare_votes(account_id,nomination_id,option_id,updated_at) values(v_account,p_nomination_id,p_option_id,now()) on conflict(account_id,nomination_id) do update set option_id=excluded.option_id,updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.save_event_choice(p_token text,p_choice_id text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_event_results jsonb;
begin
  if flare_closed() then raise exception 'Голосование завершено.'; end if;
  if p_choice_id not in ('dec-4','dec-5','dec-6') then raise exception 'Выбери один из предложенных дней.'; end if;
  insert into flare_event_choices(account_id,choice_id,updated_at) values(v_account,p_choice_id,now()) on conflict(account_id) do update set choice_id=excluded.choice_id,updated_at=now();
  select jsonb_build_object('total',coalesce(sum(votes),0),'counts',coalesce(jsonb_object_agg(choice_id,votes),'{}'::jsonb)) into v_event_results
  from (select choice_id,count(*)::integer as votes from flare_event_choices group by choice_id) poll_counts;
  return jsonb_build_object('ok',true,'event_results',v_event_results);
end $$;

create or replace function public.finalize_ballot(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_required integer; v_done integer;
begin
  if flare_closed() then raise exception 'Голосование завершено.'; end if;
  select count(*) into v_required from flare_nominations;
  select count(*) into v_done from flare_votes where account_id=v_account;
  if v_done<>v_required then raise exception 'Заполни все номинации: сейчас % из %.',v_done,v_required; end if;
  update flare_accounts set ballot_submitted_at=coalesce(ballot_submitted_at,now()) where id=v_account;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_summary(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_account uuid:=flare_session_account(p_token);
  v_votes jsonb;
  v_choices jsonb;
  v_registered jsonb;
  v_voted jsonb;
  v_not_voted jsonb;
  v_partially_voted jsonb;
  v_registered_count bigint;
  v_voted_count bigint;
  v_total_votes bigint;
  v_required integer;
begin
  if not exists(select 1 from flare_accounts where id=v_account and nickname='Maronnix') then raise exception 'Нет доступа к панели организатора.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nomination_title',n.title,'option_name',o.name,'nickname',a.nickname) order by n.title,a.nickname),'[]'::jsonb) into v_votes from flare_votes v join flare_accounts a on a.id=v.account_id join flare_nominations n on n.id=v.nomination_id join flare_options o on o.id=v.option_id;
  select coalesce(jsonb_agg(jsonb_build_object('nickname',a.nickname,'choice_label',case c.choice_id when 'dec-4' then '4 декабря · пятница' when 'dec-5' then '5 декабря · суббота' else '6 декабря · воскресенье' end) order by a.nickname),'[]'::jsonb) into v_choices from flare_event_choices c join flare_accounts a on a.id=c.account_id;
  select count(*) into v_registered_count from flare_accounts;
  select count(*) into v_required from flare_nominations;
  select count(distinct account_id),count(*) into v_voted_count,v_total_votes from flare_votes;
  select coalesce(jsonb_agg(a.nickname order by a.nickname),'[]'::jsonb) into v_registered from flare_accounts a;
  select coalesce(jsonb_agg(a.nickname order by a.nickname),'[]'::jsonb) into v_voted
  from flare_accounts a where v_required>0 and (select count(*) from flare_votes v where v.account_id=a.id)>=v_required;
  select coalesce(jsonb_agg(jsonb_build_object('nickname',a.nickname,'vote_count',vote_counts.vote_count) order by a.nickname),'[]'::jsonb) into v_partially_voted
  from flare_accounts a join (select account_id,count(*)::integer as vote_count from flare_votes group by account_id) vote_counts on vote_counts.account_id=a.id
  where vote_counts.vote_count>0 and vote_counts.vote_count<v_required;
  select coalesce(jsonb_agg(m.nickname order by m.nickname),'[]'::jsonb) into v_not_voted from flare_members m where not exists(select 1 from flare_accounts a join flare_votes v on v.account_id=a.id where a.nickname=m.nickname);
  return jsonb_build_object(
    'votes',v_votes,
    'event_preferences',v_choices,
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
revoke all on function public.flare_new_session(uuid) from public,anon,authenticated;
revoke all on function public.flare_session_account(text) from public,anon,authenticated;
revoke all on function public.flare_access(text,text) from public,authenticated;
revoke all on function public.flare_access(text,text) from anon;
revoke all on function public.flare_logout(text) from public,authenticated;

revoke all on function public.get_my_ballot(text) from public,authenticated;
revoke all on function public.cast_vote(text,text,text) from public,authenticated;
revoke all on function public.save_event_choice(text,text) from public,authenticated;
revoke all on function public.finalize_ballot(text) from public,authenticated;
revoke all on function public.admin_summary(text) from public,authenticated;
revoke all on function public.get_clip_options() from public,authenticated;
revoke all on function public.admin_update_clip_option(text,text,text,text) from public,authenticated;
revoke all on function public.get_video_options() from public,authenticated;
revoke all on function public.admin_update_video_option(text,text,text,text) from public,authenticated;
grant execute on function public.flare_access(text,text) to anon;
grant execute on function public.flare_logout(text) to anon;

grant execute on function public.get_my_ballot(text) to anon;
grant execute on function public.cast_vote(text,text,text) to anon;
grant execute on function public.save_event_choice(text,text) to anon;
grant execute on function public.finalize_ballot(text) to anon;
grant execute on function public.admin_summary(text) to anon;
grant execute on function public.get_clip_options() to anon;
grant execute on function public.admin_update_clip_option(text,text,text,text) to anon;
grant execute on function public.get_video_options() to anon;
grant execute on function public.admin_update_video_option(text,text,text,text) to anon;

INSERT INTO public.flare_nominations (id,title,category,display_type,allow_self) VALUES
('flare-king','FLARE KING','основная','Участник',false),
('game-of-year','ИГРА ГОДА','основная','Картинка',false),
('multigaming','MULTIGAMING ГОДА','основная','Участник',false),
('best-cs','ЛУЧШИЙ CS-УЧАСТНИК','основная','Участник',false),
('best-rematch','ЛУЧШИЙ REMATCH-УЧАСТНИК','основная','Участник',false),
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
('clip-1','clip-of-year','Клип 01 · скоро','video',NULL) ,
('clip-2','clip-of-year','Клип 02 · скоро','video',NULL) ,
('clip-3','clip-of-year','Клип 03 · скоро','video',NULL) ,
('clip-4','clip-of-year','Клип 04 · скоро','video',NULL) ,
('clip-5','clip-of-year','Клип 05 · скоро','video',NULL) ,
('clip-6','clip-of-year','Клип 06 · скоро','video',NULL) ,
('conflict-1','conflict-of-year','Akirakume, Dony_zq, Nodben vs Maronnix','conflict',NULL) ,
('conflict-2','conflict-of-year','Eozik, Flourin, Maronnix vs Denis_185, Fines Stark','video',NULL) ,
('conflict-3','conflict-of-year','Flourin vs Qusti','conflict',NULL) ,
('event-1','event-of-year','Akirakume получил права','image',NULL) ,
('event-2','event-of-year','Выживание в Minecraft','video',NULL) ,
('event-3','event-of-year','Ливнули с сервера','image',NULL) ,
('event-4','event-of-year','NJDC-2026','video',NULL) ,
('game-1','game-of-year','Counter-Strike 2','game',NULL) ,
('game-2','game-of-year','MECCHA CHAMELEON','game',NULL) ,
('game-3','game-of-year','Minecraft','game',NULL) ,
('game-4','game-of-year','REMATCH','game',NULL) ,
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
('person-8-akirakume','scam-of-year','Akirakume','person','Akirakume') ,
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
('squad-1','squad-of-year','Akirakume, Dony_zq, Nodben','group',NULL) ,
('squad-2','squad-of-year','Eozik, Flourin, Maronnix','group',NULL) ,
('squad-3','squad-of-year','Akirakume, Dony_zq, Maronnix, Nodben, Qusti','group',NULL) ,
('squad-4','squad-of-year','Akirakume, Dony_zq, Maronnix, Rezo1n','group',NULL)
ON CONFLICT (id) DO UPDATE SET nomination_id=excluded.nomination_id, name=case when excluded.nomination_id='clip-of-year' then existing_option.name else excluded.name end, kind=excluded.kind, person_nickname=excluded.person_nickname;
