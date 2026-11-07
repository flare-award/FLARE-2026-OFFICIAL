-- Preserve votes; change future vote validation only.
begin;
update public.flare_nominations set allow_self=true where id='clip-of-year';
update public.flare_nominations set allow_self=false where id='scam-of-year';
create or replace function public.cast_vote(p_token text,p_nomination_id text,p_option_id text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_account uuid:=flare_session_account(p_token); v_nickname text; v_is_test_account boolean:=false;
begin
  perform flare_assert_account_access(v_account);
  if flare_closed() then raise exception 'Голосование завершено. Голоса больше нельзя изменить.'; end if;
  select nickname,is_test_account into v_nickname,v_is_test_account from flare_accounts where id=v_account;
  if not exists(select 1 from flare_options o join flare_nominations n on n.id=o.nomination_id where o.id=p_option_id and o.nomination_id=p_nomination_id) then raise exception 'Такого номинанта нет.'; end if;
  if v_is_test_account and exists(select 1 from flare_options where id=p_option_id and nomination_id=p_nomination_id and hidden_for_testers) then raise exception 'Этот номинант скрыт в тестовом режиме.'; end if;
  if exists(select 1 from flare_options o join flare_nominations n on n.id=o.nomination_id where o.id=p_option_id and o.nomination_id=p_nomination_id and o.kind='person' and o.person_nickname=v_nickname and not n.allow_self) then raise exception 'Нельзя голосовать за себя.'; end if;
  if p_nomination_id='scam-of-year' and exists(
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
commit;
