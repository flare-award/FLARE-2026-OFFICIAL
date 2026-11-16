-- Close nomination voting immediately while leaving the ceremony-date poll open.
-- The date poll closes 48 hours before its currently leading ceremony date.

CREATE OR REPLACE FUNCTION public.flare_closed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT now() >= timestamptz '2026-10-23 00:00:00+00'
$$;

CREATE OR REPLACE FUNCTION public.flare_event_poll_closes_at()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  WITH tallies AS (
    SELECT choice_id, COUNT(*)::integer AS vote_count
    FROM public.flare_event_choices
    GROUP BY choice_id
  ), leaders AS (
    SELECT choice_id
    FROM tallies
    WHERE vote_count = (SELECT MAX(vote_count) FROM tallies)
  )
  SELECT MIN(CASE choice_id
    WHEN 'dec-4' THEN timestamptz '2026-12-04 00:00:00+03'
    WHEN 'dec-5' THEN timestamptz '2026-12-05 00:00:00+03'
    WHEN 'dec-6' THEN timestamptz '2026-12-06 00:00:00+03'
  END) - interval '2 days'
  FROM leaders
$$;

CREATE OR REPLACE FUNCTION public.flare_event_poll_closed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(now() >= public.flare_event_poll_closes_at(), false)
$$;

CREATE OR REPLACE FUNCTION public.save_event_choice(p_token text, p_choice_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_account uuid := public.flare_session_account(p_token);
  v_is_test_account boolean := false;
  v_event_results jsonb;
BEGIN
  PERFORM public.flare_assert_account_access(v_account);
  IF public.flare_event_poll_closed() THEN
    RAISE EXCEPTION 'Опрос даты премии закрыт.';
  END IF;
  IF p_choice_id NOT IN ('dec-4', 'dec-5', 'dec-6') THEN
    RAISE EXCEPTION 'Выбери один из предложенных дней.';
  END IF;

  SELECT is_test_account INTO v_is_test_account
  FROM public.flare_accounts
  WHERE id = v_account;

  IF v_is_test_account THEN
    INSERT INTO public.flare_test_event_choices(account_id, choice_id, updated_at)
    VALUES(v_account, p_choice_id, now())
    ON CONFLICT(account_id) DO UPDATE
      SET choice_id = EXCLUDED.choice_id, updated_at = now();
  ELSE
    INSERT INTO public.flare_event_choices(account_id, choice_id, updated_at)
    VALUES(v_account, p_choice_id, now())
    ON CONFLICT(account_id) DO UPDATE
      SET choice_id = EXCLUDED.choice_id, updated_at = now();
  END IF;

  SELECT jsonb_build_object(
    'total', COALESCE(SUM(votes), 0),
    'counts', COALESCE(jsonb_object_agg(choice_id, votes), '{}'::jsonb)
  ) INTO v_event_results
  FROM (
    SELECT choice_id, COUNT(*)::integer AS votes
    FROM public.flare_event_choices
    GROUP BY choice_id
  ) poll_counts;

  RETURN jsonb_build_object(
    'ok', true,
    'event_results', v_event_results,
    'test_vote', v_is_test_account,
    'event_poll_closed', public.flare_event_poll_closed()
  );
END
$$;

CREATE OR REPLACE FUNCTION public.get_event_poll_winner()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_choice_ids jsonb;
  v_closed boolean;
  v_closes_at timestamptz;
BEGIN
  WITH tallies AS (
    SELECT choice_id, COUNT(*)::integer AS vote_count
    FROM public.flare_event_choices
    GROUP BY choice_id
  ), leaders AS (
    SELECT choice_id
    FROM tallies
    WHERE vote_count = (SELECT MAX(vote_count) FROM tallies)
  )
  SELECT COALESCE(jsonb_agg(choice_id ORDER BY choice_id), '[]'::jsonb)
  INTO v_choice_ids
  FROM leaders;

  v_closed := public.flare_event_poll_closed();
  v_closes_at := public.flare_event_poll_closes_at();

  RETURN jsonb_build_object(
    'closed', v_closed,
    'choice_ids', v_choice_ids,
    'closes_at', v_closes_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.flare_event_poll_closes_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.flare_event_poll_closed() FROM public, anon, authenticated;
