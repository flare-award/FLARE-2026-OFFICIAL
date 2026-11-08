-- Derive winner badges from the same vote tallies as get_public_winners.
-- The options table has no is_winner column; tied leaders all win.
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
