-- Refuse removal if a vote arrived since the preflight check; never cascade-delete ballots.
do $$
begin
  perform 1 from public.flare_options
    where id='person-5-cloury' and nomination_id='meme-of-year' for update;
  if exists(select 1 from public.flare_votes where option_id='person-5-cloury')
     or exists(select 1 from public.flare_test_votes where option_id='person-5-cloury') then
    raise exception 'Cloury has saved votes in meme-of-year; preserve ballots and review before removal.';
  end if;
  delete from public.flare_options where id='person-5-cloury' and nomination_id='meme-of-year';
end $$;
insert into public.flare_options(id,nomination_id,name,kind,person_nickname) values
  ('person-5-nodben','meme-of-year','Nodben','person','Nodben'),
  ('person-5-rezo1n','meme-of-year','Rezo1n','person','Rezo1n')
on conflict(id) do nothing;
