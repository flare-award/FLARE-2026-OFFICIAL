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
