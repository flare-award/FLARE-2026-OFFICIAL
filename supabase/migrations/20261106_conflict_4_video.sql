-- Treat Izumrudik vs Cloury as a video nominee in the shared catalog.
-- Run after 20261106_profile_unified_appearance.sql. Safe to re-run.
begin;

insert into public.flare_options(id,nomination_id,name,kind,person_nickname) values
('conflict-4','conflict-of-year','Izumrudik vs Cloury','video',null)
on conflict(id) do update set nomination_id=excluded.nomination_id,name=excluded.name,kind=excluded.kind,person_nickname=excluded.person_nickname;

commit;
