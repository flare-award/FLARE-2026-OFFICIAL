-- Preserve the option ID and all ballot references; change only this nomination's participant.
update public.flare_options
set name='Nodben', person_nickname='Nodben'
where id='person-2-dony-zq' and nomination_id='multigaming' and kind='person';
