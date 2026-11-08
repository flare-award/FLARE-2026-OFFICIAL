-- Add candidates only. Never rename/reuse an existing option or alter ballots.
-- person-2-dony-zq remains Nodben's historical ID; Dony_zq gets a distinct ID.
insert into public.flare_options(id,nomination_id,name,kind,person_nickname) values
  ('multigaming-dony-zq','multigaming','Dony_zq','person','Dony_zq'),
  ('conflict-5','conflict-of-year','Awal vs Izumrudik','video',null),
  ('person-8-flourin','scam-of-year','Flourin','person','Flourin'),
  ('clip-7','clip-of-year','Izumrudik взорвал дом Awal','video',null)
on conflict(id) do nothing;
-- No video URL has been supplied: links can be added in Design → Video.
