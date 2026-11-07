-- Exception belongs to the existing clip ID, not to all Flourin clips or a mutable title.
-- Patch only this condition, preserving the currently deployed RPC and its access checks.
do $$
declare
  definition text:=pg_get_functiondef('public.cast_vote(text,text,text)'::regprocedure);
  old_guard text:='if p_nomination_id=''clip-of-year'' and exists(';
  new_guard text:='if p_nomination_id=''clip-of-year'' and p_option_id<>''clip-4'' and exists(';
begin
  if position(new_guard in definition)>0 then return; end if;
  if position(old_guard in definition)=0 then raise exception 'Unexpected cast_vote definition; no changes applied.'; end if;
  execute replace(definition,old_guard,new_guard);
end $$;
