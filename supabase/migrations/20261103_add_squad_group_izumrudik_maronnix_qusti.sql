-- Add the Izumrudik, Maronnix, Qusti group as an image nominee.
-- Run once in the Supabase SQL Editor to make voting accept squad-5.
INSERT INTO public.flare_options AS existing_option (id, nomination_id, name, kind, person_nickname)
VALUES ('squad-5', 'squad-of-year', 'Izumrudik, Maronnix, Qusti', 'group', NULL)
ON CONFLICT (id) DO UPDATE
SET nomination_id = EXCLUDED.nomination_id,
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    person_nickname = EXCLUDED.person_nickname;
