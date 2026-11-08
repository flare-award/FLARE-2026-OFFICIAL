-- Run in Supabase SQL Editor after the existing FLARE schema.
-- Adds Dub Together, tester-only nominee locks, and an admin view of the test ballot.
begin;

alter table public.flare_options add column if not exists hidden_for_testers boolean not null default false;

insert into public.flare_options(id,nomination_id,name,kind,person_nickname)
values('game-5','game-of-year','Dub Together','game',null)
on conflict(id) do update set nomination_id=excluded.nomination_id,name=excluded.name,kind=excluded.kind,person_nickname=excluded.person_nickname;

-- Keep the clip allowed by the test ballot if the database still has the default placeholder.
update public.flare_options
set name='Qusti въебал все коины'
where id='clip-1' and nomination_id='clip-of-year' and name='Клип 01 · скоро'
  and not exists(select 1 from public.flare_options where nomination_id='clip-of-year' and lower(trim(name))=lower('Qusti въебал все коины'));

update public.flare_options set hidden_for_testers=false;
update public.flare_options
set hidden_for_testers=case
  when nomination_id='clip-of-year' then lower(trim(name))<>lower('Qusti въебал все коины')
  else true
end
where nomination_id='clip-of-year'
   or id in ('event-1','event-2','squad-4','squad-5','sos-1','sos-2','sos-5','conflict-1')
   or name in ('Akirakume получил права','Выживание в Minecraft','Akirakume, Dony_zq, Maronnix, Rezo1n','Izumrudik, Maronnix, Qusti','Камбэк CYBERSHOKE летом','Возвращение на сервер','Сезон с Blue Lock в REMATCH','Akirakume, Dony_zq, Nodben, Maronnix');

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

revoke all on function public.admin_summary(text) from public,authenticated;
grant execute on function public.admin_summary(text) to anon;
revoke all on function public.admin_update_clip_option(text,text,text,text) from public,authenticated;
grant execute on function public.admin_update_clip_option(text,text,text,text) to anon;

commit;
