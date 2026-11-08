-- Replace the squad-4 lineup without deleting/recreating the option or its ballots.
do $$ begin
 update public.flare_options set name='Akirakume, Nodben, Rezo1n'
 where id='squad-4' and nomination_id='squad-of-year' and kind='group'
 and name in ('Akirakume, Awal, Dony_zq, Maronnix, Rezo1n','Akirakume, Nodben, Rezo1n');
 if not found then raise exception 'Unexpected squad-4 identity; no changes made.'; end if;
end $$;
