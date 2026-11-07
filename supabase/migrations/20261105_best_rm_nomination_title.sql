-- Match the public label for the existing Best REMATCH nomination.
begin;
update public.flare_nominations
set title='ЛУЧШИЙ RM-УЧАСТНИК'
where id='best-rematch';
commit;
