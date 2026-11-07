-- Rename in place; preserve nominee IDs, photo paths, tester visibility and votes.
begin;
update public.flare_options set name='Akirakume, Dony_zq, Maronnix, Nodben' where id='squad-3' and nomination_id='squad-of-year';
update public.flare_options set name='Akirakume, Awal, Dony_zq, Maronnix, Rezo1n' where id='squad-4' and nomination_id='squad-of-year';
commit;

-- Check the result after running in Supabase SQL Editor.
select id, nomination_id, name
from public.flare_options
where nomination_id='squad-of-year' and id in ('squad-3','squad-4')
order by id;
