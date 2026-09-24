-- Shared bounded page sync and terminal legacy-scope retirement. Local only.

BEGIN;

ALTER TABLE public.booqable_sync_runs
  ADD COLUMN IF NOT EXISTS retirement_reason text;
ALTER TABLE public.booqable_sync_runs
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

CREATE OR REPLACE FUNCTION private.booqable_sync_run_compatible(p_run public.booqable_sync_runs)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce((p_run.scope IN ('selected_period', 'next_7_days')
    AND p_run.policy_version = CASE p_run.scope WHEN 'selected_period' THEN 1 ELSE 2 END
    AND p_run.from_date IS NOT NULL AND p_run.to_date IS NOT NULL
    AND p_run.to_date >= p_run.from_date
    AND (p_run.scope <> 'next_7_days' OR p_run.to_date = p_run.from_date + 6)
    AND p_run.from_instant = (p_run.from_date::timestamp AT TIME ZONE 'Europe/Madrid')
    AND p_run.to_instant_exclusive = ((p_run.to_date + 1)::timestamp AT TIME ZONE 'Europe/Madrid')
    AND p_run.discovery_phase IN ('starts_at', 'stops_at', 'reconcile')
    AND (p_run.scope <> 'next_7_days' OR p_run.discovery_phase <> 'stops_at')
    AND p_run.discovery_page >= 1), false);
$$;

-- Do not replace the old worker RPCs while a legacy run still owns a valid
-- lease. Holding the lease table lock closes the acquire/check race until this
-- migration commits. CI can retry after that worker finishes or its lease dies.
LOCK TABLE private.booqable_run_leases IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.booqable_sync_runs r
    JOIN private.booqable_run_leases l ON l.run_id = r.id
    WHERE l.lock_key = 'manual_sync' AND l.expires_at > now()
      AND r.state = 'in_progress'
      AND (r.scope = 'all_reserved' OR
        (r.scope = 'next_7_days' AND NOT private.booqable_sync_run_compatible(r)))
  ) THEN
    RAISE EXCEPTION 'An older sync worker still holds the run lease; retry this migration after it finishes or expires';
  END IF;
END $$;

-- Preserve all original outcome fields and cursor evidence. Replays do not
-- change the first retirement timestamp or append duplicate evidence.
UPDATE public.booqable_sync_runs
SET retired_at = coalesce(retired_at, now()),
    retirement_reason = coalesce(retirement_reason, 'all_reserved execution retired'),
    state = CASE WHEN state = 'in_progress' THEN 'failed' ELSE state END,
    finished_at = CASE WHEN state <> 'succeeded' THEN coalesce(finished_at, now()) ELSE finished_at END
WHERE scope = 'all_reserved' AND retired_at IS NULL;

-- Old Workshop runs have no frozen dates, so their cursor cannot be resumed.
-- Preserve every original result and cursor while making execution terminal.
UPDATE public.booqable_sync_runs r SET
  state = 'failed',
  retired_at = coalesce(r.retired_at, now()),
  retirement_reason = coalesce(r.retirement_reason,
    'Previous Workshop run has no compatible saved interval; start a fresh sync'),
  finished_at = coalesce(r.finished_at, now())
WHERE r.scope = 'next_7_days' AND r.state IN ('in_progress', 'failed')
  AND r.retired_at IS NULL AND NOT private.booqable_sync_run_compatible(r);

CREATE OR REPLACE FUNCTION private.dashboard_sync_payload(p_run public.booqable_sync_runs, p_lease jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'ok', true, 'runId', p_run.id, 'scope', p_run.scope, 'state', p_run.state,
    'cursor', NULL, 'counts', jsonb_build_object(
      'listed', p_run.listed, 'succeeded', p_run.succeeded,
      'failed', p_run.failed, 'skipped', p_run.skipped),
    'token', p_lease->>'token', 'fence', (p_lease->>'fence')::bigint,
    'fromDate', p_run.from_date, 'toDate', p_run.to_date,
    'fromInstant', p_run.from_instant, 'toInstantExclusive', p_run.to_instant_exclusive,
    'phase', p_run.discovery_phase, 'page', p_run.discovery_page,
    'attempt', p_run.attempt, 'policyVersion', p_run.policy_version
  );
$$;

CREATE OR REPLACE FUNCTION private.workshop_start_window_sync()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_lease jsonb; v_run public.booqable_sync_runs;
        v_from date; v_closed integer;
BEGIN
  v_denied := private.workshop_staff_or_forbidden();
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  v_from := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_lease := private.booqable_acquire_run_lease(
    'manual_sync', now() + interval '2 minutes',
    'staff:' || coalesce((SELECT auth.uid())::text, 'unknown'));
  IF coalesce(v_lease->>'ok', 'false') <> 'true' THEN RETURN v_lease; END IF;

  -- Also handle an old run introduced after migration, without requiring one
  -- staff click per historical row.
  UPDATE public.booqable_sync_runs r SET
    state = 'failed', retired_at = now(),
    retirement_reason = 'Previous Workshop run has no compatible saved interval; start a fresh sync',
    finished_at = coalesce(r.finished_at, now())
  WHERE r.scope = 'next_7_days' AND r.state IN ('in_progress', 'failed')
    AND NOT private.booqable_sync_run_compatible(r) AND r.retired_at IS NULL;
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  IF v_closed > 0 THEN
    PERFORM private.booqable_release_run_lease('manual_sync',
      (v_lease->>'token')::uuid, (v_lease->>'fence')::bigint);
    RETURN private.workshop_err('SOURCE_UNAVAILABLE',
      'Previous Workshop refresh was closed; start a fresh sync.');
  END IF;

  INSERT INTO public.booqable_sync_runs (
    scope, state, policy_version, from_date, to_date, from_instant,
    to_instant_exclusive, discovery_phase, discovery_page)
  VALUES ('next_7_days', 'in_progress', 2, v_from, v_from + 6,
    v_from::timestamp AT TIME ZONE 'Europe/Madrid',
    (v_from + 7)::timestamp AT TIME ZONE 'Europe/Madrid', 'starts_at', 1)
  RETURNING * INTO v_run;
  INSERT INTO private.dashboard_sync_candidates (run_id, booqable_order_id)
  SELECT v_run.id, o.booqable_order_id FROM public.orders o
  WHERE o.booqable_order_id IS NOT NULL AND o.status = 'reserved'
    AND o.starts_at >= v_run.from_instant
    AND o.starts_at < v_run.to_instant_exclusive
  ON CONFLICT DO NOTHING;
  UPDATE private.booqable_run_leases SET run_id = v_run.id
  WHERE lock_key = 'manual_sync' AND token = (v_lease->>'token')::uuid
    AND fence = (v_lease->>'fence')::bigint;
  RETURN private.dashboard_sync_payload(v_run, v_lease);
END; $$;

CREATE OR REPLACE FUNCTION private.dashboard_abort_selected_sync(
  p_run_id uuid, p_token uuid, p_fence bigint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_owner text; v_run_id uuid; v_run public.booqable_sync_runs;
BEGIN
  v_denied := private.workshop_staff_or_forbidden();
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  SELECT owner, run_id INTO v_owner, v_run_id FROM private.booqable_run_leases
  WHERE lock_key = 'manual_sync' AND token = p_token
    AND fence = p_fence AND expires_at > now() FOR UPDATE;
  IF v_run_id IS NULL OR (p_run_id IS NOT NULL AND v_run_id IS DISTINCT FROM p_run_id)
     OR v_owner IS DISTINCT FROM ('staff:' || (SELECT auth.uid())::text) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh lease is no longer current.');
  END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = v_run_id FOR UPDATE;
  IF v_run.id IS NULL OR NOT private.booqable_sync_run_compatible(v_run) OR v_run.state <> 'in_progress'
     OR v_run.retired_at IS NOT NULL THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh run is no longer active.');
  END IF;
  UPDATE public.booqable_sync_runs SET state = 'failed',
    last_error = left(coalesce(nullif(p_reason, ''), 'Refresh worker could not continue.'), 1000),
    finished_at = now(), last_attempt_at = now(), updated_at = now()
  WHERE id = v_run_id;
  PERFORM private.booqable_release_run_lease('manual_sync', p_token, p_fence);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.workshop_start_window_sync()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.workshop_start_window_sync();
$$;

CREATE OR REPLACE FUNCTION private.workshop_resume_window_sync(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_lease jsonb; v_run public.booqable_sync_runs;
BEGIN
  v_denied := private.workshop_staff_or_forbidden();
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run.scope = 'all_reserved' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'all_reserved sync scope is retired.');
  END IF;
  IF v_run.id IS NULL OR v_run.scope IS DISTINCT FROM 'next_7_days'
     OR v_run.retired_at IS NOT NULL THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Workshop refresh cannot be resumed; start again.');
  END IF;
  IF v_run.state = 'succeeded' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh already completed.');
  END IF;
  v_lease := private.booqable_acquire_run_lease(
    'manual_sync', now() + interval '2 minutes',
    'staff:' || coalesce((SELECT auth.uid())::text, 'unknown'));
  IF coalesce(v_lease->>'ok', 'false') <> 'true' THEN RETURN v_lease; END IF;
  IF NOT private.booqable_sync_run_compatible(v_run) THEN
    UPDATE public.booqable_sync_runs SET state = 'failed',
      retired_at = now(),
      retirement_reason = 'Saved Workshop run has incompatible bounds or progress; start a fresh sync',
      finished_at = coalesce(finished_at, now())
    WHERE id = p_run_id;
    PERFORM private.booqable_release_run_lease('manual_sync',
      (v_lease->>'token')::uuid, (v_lease->>'fence')::bigint);
    RETURN private.workshop_err('SOURCE_UNAVAILABLE',
      'Saved Workshop refresh was closed; start a fresh sync.');
  END IF;
  UPDATE public.booqable_sync_runs SET state = 'in_progress',
    attempt = attempt + CASE WHEN state = 'failed' THEN 1 ELSE 0 END,
    last_attempt_at = now(), updated_at = now()
  WHERE id = p_run_id RETURNING * INTO v_run;
  UPDATE private.booqable_run_leases SET run_id = v_run.id
  WHERE lock_key = 'manual_sync' AND token = (v_lease->>'token')::uuid
    AND fence = (v_lease->>'fence')::bigint;
  RETURN private.dashboard_sync_payload(v_run, v_lease);
END; $$;

CREATE OR REPLACE FUNCTION public.workshop_resume_window_sync(run_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.workshop_resume_window_sync(run_id);
$$;

CREATE OR REPLACE FUNCTION private.dashboard_resume_selected_sync(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_lease jsonb; v_run public.booqable_sync_runs;
BEGIN
  v_denied := private.workshop_staff_or_forbidden();
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run.scope = 'all_reserved' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'all_reserved sync scope is retired.');
  END IF;
  IF v_run.id IS NULL OR v_run.scope IS DISTINCT FROM 'selected_period' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Selected refresh cannot be resumed; start again.');
  END IF;
  IF v_run.state = 'succeeded' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh already completed.');
  END IF;
  IF v_run.retired_at IS NOT NULL THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Selected refresh was closed; start again.');
  END IF;
  v_lease := private.booqable_acquire_run_lease(
    'manual_sync', now() + interval '2 minutes',
    'staff:' || coalesce((SELECT auth.uid())::text, 'unknown'));
  IF coalesce(v_lease->>'ok', 'false') <> 'true' THEN RETURN v_lease; END IF;
  IF NOT private.booqable_sync_run_compatible(v_run) THEN
    UPDATE public.booqable_sync_runs SET state = 'failed',
      retired_at = now(),
      retirement_reason = 'Previous selected-period run has no compatible saved interval; start a fresh sync',
      finished_at = coalesce(finished_at, now())
    WHERE id = p_run_id;
    PERFORM private.booqable_release_run_lease('manual_sync',
      (v_lease->>'token')::uuid, (v_lease->>'fence')::bigint);
    RETURN private.workshop_err('SOURCE_UNAVAILABLE',
      'Previous selected refresh was closed; start again.');
  END IF;
  UPDATE public.booqable_sync_runs SET state = 'in_progress',
    attempt = attempt + CASE WHEN state = 'failed' THEN 1 ELSE 0 END,
    last_attempt_at = now(), updated_at = now()
  WHERE id = p_run_id RETURNING * INTO v_run;
  UPDATE private.booqable_run_leases SET run_id = v_run.id
  WHERE lock_key = 'manual_sync' AND token = (v_lease->>'token')::uuid
    AND fence = (v_lease->>'fence')::bigint;
  RETURN private.dashboard_sync_payload(v_run, v_lease);
END; $$;

-- Older public and private entry points stay callable for old clients, but
-- they cannot recreate an unbounded run or revive all_reserved history.
CREATE OR REPLACE FUNCTION private.workshop_start_manual_sync(p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_scope = 'all_reserved' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'all_reserved sync scope is retired.');
  END IF;
  IF p_scope = 'next_7_days' THEN RETURN private.workshop_start_window_sync(); END IF;
  RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Unknown sync scope.');
END; $$;

CREATE OR REPLACE FUNCTION private.workshop_resume_manual_sync(p_run_id uuid, p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_scope text;
BEGIN
  SELECT scope INTO v_scope FROM public.booqable_sync_runs WHERE id = p_run_id;
  IF p_scope = 'all_reserved' OR v_scope = 'all_reserved' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'all_reserved sync scope is retired.');
  END IF;
  IF p_scope = 'next_7_days' AND v_scope = 'next_7_days' THEN
    RETURN private.workshop_resume_window_sync(p_run_id);
  END IF;
  RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Scope mismatch; restart sync.');
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_checkpoint_selected_sync(
  run_id uuid, token uuid, fence bigint, phase text, page integer,
  candidate_ids text[], has_more boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run public.booqable_sync_runs;
BEGIN
  IF NOT private.dashboard_sync_assert_lease(run_id, token, fence) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh lease expired.');
  END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = run_id FOR UPDATE;
  IF v_run.id IS NULL OR NOT private.booqable_sync_run_compatible(v_run) OR v_run.state <> 'in_progress'
     OR v_run.retired_at IS NOT NULL
     OR v_run.discovery_phase IS DISTINCT FROM phase
     OR v_run.discovery_page IS DISTINCT FROM page
     OR phase NOT IN ('starts_at', 'stops_at')
     OR (v_run.scope = 'next_7_days' AND phase <> 'starts_at')
     OR has_more IS NULL OR candidate_ids IS NULL
     OR array_position(candidate_ids, NULL) IS NOT NULL THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh checkpoint mismatch.');
  END IF;
  INSERT INTO private.dashboard_sync_candidates (run_id, booqable_order_id)
  SELECT run_id, x FROM unnest(candidate_ids) AS x WHERE x <> ''
  ON CONFLICT DO NOTHING;
  UPDATE public.booqable_sync_runs SET
    discovery_phase = CASE WHEN has_more THEN phase
      WHEN phase = 'starts_at' AND v_run.scope = 'selected_period' THEN 'stops_at'
      ELSE 'reconcile' END,
    discovery_page = CASE WHEN has_more THEN page + 1 ELSE 1 END,
    last_error = NULL, updated_at = now()
  WHERE id = run_id RETURNING * INTO v_run;
  RETURN private.dashboard_sync_payload(v_run, NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_selected_sync_work(
  run_id uuid, token uuid, fence bigint, batch_size integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run public.booqable_sync_runs; v_ids jsonb;
BEGIN
  IF NOT private.dashboard_sync_assert_lease(run_id, token, fence) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh lease expired.');
  END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = run_id;
  IF v_run.id IS NULL OR NOT private.booqable_sync_run_compatible(v_run) OR v_run.state <> 'in_progress'
     OR v_run.retired_at IS NOT NULL OR v_run.discovery_phase <> 'reconcile'
     OR batch_size IS NULL OR batch_size < 1 OR batch_size > 10 THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh work state mismatch.');
  END IF;
  SELECT coalesce(jsonb_agg(q.booqable_order_id), '[]'::jsonb) INTO v_ids FROM (
    SELECT c.booqable_order_id FROM private.dashboard_sync_candidates c
    LEFT JOIN public.booqable_sync_order_results r
      ON r.run_id = c.run_id AND r.booqable_order_id = c.booqable_order_id
    WHERE c.run_id = v_run.id AND (r.id IS NULL OR (NOT r.ok AND r.attempt < v_run.attempt))
    ORDER BY c.booqable_order_id LIMIT batch_size
  ) q;
  RETURN jsonb_build_object('ok', true, 'ids', v_ids);
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_record_selected_result(
  run_id uuid, token uuid, fence bigint, booqable_order_id text,
  ok boolean, code text, error text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run public.booqable_sync_runs; v_result jsonb;
BEGIN
  IF NOT private.dashboard_sync_assert_lease(run_id, token, fence) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh lease expired.');
  END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = run_id FOR UPDATE;
  IF v_run.id IS NULL OR NOT private.booqable_sync_run_compatible(v_run) OR v_run.state <> 'in_progress'
     OR v_run.retired_at IS NOT NULL OR v_run.discovery_phase <> 'reconcile'
     OR NOT EXISTS (SELECT 1 FROM private.dashboard_sync_candidates c
       WHERE c.run_id = $1 AND c.booqable_order_id = $4) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Unknown refresh candidate.');
  END IF;
  v_result := private.booqable_record_sync_result(run_id, booqable_order_id, ok, code, error, false);
  IF coalesce(v_result->>'ok', 'false') <> 'true' THEN RETURN v_result; END IF;
  UPDATE public.booqable_sync_order_results r SET attempt = v_run.attempt
  WHERE r.run_id = $1 AND r.booqable_order_id = $4;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_finish_selected_sync(
  run_id uuid, token uuid, fence bigint, listing_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run public.booqable_sync_runs; v_pending integer; v_state text;
BEGIN
  IF NOT private.dashboard_sync_assert_lease(run_id, token, fence) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh lease expired.');
  END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = run_id FOR UPDATE;
  IF v_run.id IS NULL OR NOT private.booqable_sync_run_compatible(v_run) OR v_run.state <> 'in_progress'
     OR v_run.retired_at IS NOT NULL THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Unknown refresh run.');
  END IF;
  SELECT count(*)::integer INTO v_pending FROM private.dashboard_sync_candidates c
  LEFT JOIN public.booqable_sync_order_results r
    ON r.run_id = c.run_id AND r.booqable_order_id = c.booqable_order_id
  WHERE c.run_id = $1 AND (r.id IS NULL OR (NOT r.ok AND r.attempt < v_run.attempt));
  v_state := CASE WHEN listing_error IS NOT NULL OR v_run.failed > 0 THEN 'failed'
    WHEN v_run.discovery_phase = 'reconcile' AND v_pending = 0 THEN 'succeeded'
    ELSE 'in_progress' END;
  UPDATE public.booqable_sync_runs SET state = v_state,
    last_error = CASE WHEN listing_error IS NOT NULL THEN listing_error
      WHEN v_run.failed > 0 THEN (SELECT error FROM public.booqable_sync_order_results
        WHERE booqable_sync_order_results.run_id = v_run.id AND NOT ok ORDER BY created_at DESC LIMIT 1)
      ELSE NULL END,
    last_attempt_at = now(), updated_at = now(),
    finished_at = CASE WHEN v_state IN ('succeeded', 'failed') THEN now() ELSE NULL END
  WHERE id = run_id RETURNING * INTO v_run;
  RETURN private.dashboard_sync_payload(v_run, NULL);
END; $$;

-- The old unbounded completion API must never convert retired history into
-- success or advance the shared legacy health timestamp.
CREATE OR REPLACE FUNCTION private.booqable_finish_sync_run(
  p_run_id uuid, p_cursor text, p_last_error text,
  p_listing_failed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run public.booqable_sync_runs; v_state text;
BEGIN
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run.id IS NULL THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'Sync run not found.');
  END IF;
  IF v_run.scope = 'all_reserved' THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'all_reserved sync scope is retired.');
  END IF;
  IF v_run.state <> 'in_progress' OR v_run.retired_at IS NOT NULL
     OR v_run.policy_version IS NOT NULL THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'Legacy sync run is no longer active.');
  END IF;
  v_state := CASE WHEN p_listing_failed OR v_run.failed > 0 THEN 'failed'
    WHEN p_cursor IS NULL THEN 'succeeded' ELSE 'in_progress' END;
  UPDATE public.booqable_sync_runs SET cursor = p_cursor, state = v_state,
    last_error = p_last_error, last_attempt_at = now(),
    finished_at = CASE WHEN p_cursor IS NULL THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_run_id RETURNING * INTO v_run;
  RETURN jsonb_build_object('ok', true, 'runId', v_run.id, 'state', v_run.state,
    'cursor', v_run.cursor, 'counts', jsonb_build_object(
      'listed', v_run.listed, 'succeeded', v_run.succeeded,
      'failed', v_run.failed, 'skipped', v_run.skipped));
END; $$;

-- Workshop freshness is evidence for the current exact Madrid window. A
-- historical all_reserved success or an older seven-day run proves neither.
CREATE OR REPLACE VIEW public.workshop_sync_health
WITH (security_invoker = true) AS
SELECT s.last_success_at, r.id AS run_id, r.scope, r.state, r.cursor,
  r.listed, r.succeeded, r.failed, r.skipped, r.last_error, r.last_attempt_at
FROM (SELECT (
  SELECT max(x.finished_at) FROM public.booqable_sync_runs x
  WHERE x.scope = 'next_7_days' AND x.policy_version = 2
    AND x.state = 'succeeded' AND x.retired_at IS NULL
    AND x.from_date = (now() AT TIME ZONE 'Europe/Madrid')::date
    AND x.to_date = (now() AT TIME ZONE 'Europe/Madrid')::date + 6
    AND x.from_instant = (x.from_date::timestamp AT TIME ZONE 'Europe/Madrid')
    AND x.to_instant_exclusive = ((x.to_date + 1)::timestamp AT TIME ZONE 'Europe/Madrid')
  ) AS last_success_at) s
LEFT JOIN LATERAL (
  SELECT * FROM public.booqable_sync_runs x
  WHERE x.scope = 'next_7_days' AND x.policy_version = 2
    AND x.retired_at IS NULL
    AND x.from_date = (now() AT TIME ZONE 'Europe/Madrid')::date
    AND x.to_date = (now() AT TIME ZONE 'Europe/Madrid')::date + 6
  ORDER BY x.last_attempt_at DESC, x.created_at DESC LIMIT 1
) r ON true;

REVOKE ALL ON FUNCTION private.booqable_sync_run_compatible(public.booqable_sync_runs)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.workshop_start_window_sync()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.workshop_resume_window_sync(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workshop_start_window_sync()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workshop_resume_window_sync(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.workshop_start_window_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION private.workshop_resume_window_sync(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_start_window_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_resume_window_sync(uuid) TO authenticated;

COMMIT;
