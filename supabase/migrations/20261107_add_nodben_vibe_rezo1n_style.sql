-- Add nominees without changing existing options or votes.
insert into public.flare_options(id,nomination_id,name,kind,person_nickname) values
('person-7-nodben','vibe-of-year','Nodben','person','Nodben'),
('person-9-rezo1n','style-of-year','Rezo1n','person','Rezo1n')
on conflict(id) do nothing;
