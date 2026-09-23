-- Selected-period Dashboard refresh. Existing Workshop scopes and run rows retain their meaning.
-- Idempotent; local migration only.

ALTER TABLE public.booqable_sync_runs DROP CONSTRAINT IF EXISTS booqable_sync_runs_scope_check;
ALTER TABLE public.booqable_sync_runs ADD CONSTRAINT booqable_sync_runs_scope_check
  CHECK (scope IN ('next_7_days', 'all_reserved', 'selected_period'));
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS policy_version integer;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS from_date date;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS to_date date;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS from_instant timestamptz;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS to_instant_exclusive timestamptz;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS discovery_phase text;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS discovery_page integer;
ALTER TABLE public.booqable_sync_runs ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1;
ALTER TABLE public.booqable_sync_order_results ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS private.dashboard_sync_candidates (
  run_id uuid NOT NULL REFERENCES public.booqable_sync_runs(id) ON DELETE CASCADE,
  booqable_order_id text NOT NULL,
  PRIMARY KEY (run_id, booqable_order_id)
);
REVOKE ALL ON TABLE private.dashboard_sync_candidates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.dashboard_sync_candidates TO service_role;

CREATE OR REPLACE FUNCTION private.dashboard_sync_payload(p_run public.booqable_sync_runs, p_lease jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'ok', true, 'runId', p_run.id, 'state', p_run.state,
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

CREATE OR REPLACE FUNCTION private.dashboard_start_selected_sync(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_lease jsonb; v_run public.booqable_sync_runs;
BEGIN
  v_denied := private.workshop_staff_or_forbidden();
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Invalid selected dates.');
  END IF;
  v_lease := private.booqable_acquire_run_lease(
    'manual_sync', now() + interval '2 minutes',
    'staff:' || coalesce((SELECT auth.uid())::text, 'unknown'));
  IF coalesce(v_lease->>'ok', 'false') <> 'true' THEN RETURN v_lease; END IF;
  INSERT INTO public.booqable_sync_runs (
    scope, state, policy_version, from_date, to_date, from_instant,
    to_instant_exclusive, discovery_phase, discovery_page)
  VALUES (
    'selected_period', 'in_progress', 1, p_from, p_to,
    p_from::timestamp AT TIME ZONE 'Europe/Madrid',
    (p_to + 1)::timestamp AT TIME ZONE 'Europe/Madrid', 'starts_at', 1)
  RETURNING * INTO v_run;
  INSERT INTO private.dashboard_sync_candidates (run_id, booqable_order_id)
  SELECT v_run.id, o.booqable_order_id
  FROM public.orders o
  WHERE o.booqable_order_id IS NOT NULL
    AND o.status IN ('reserved', 'started', 'stopped')
    AND (o.starts_at >= v_run.from_instant AND o.starts_at < v_run.to_instant_exclusive
      OR o.stops_at >= v_run.from_instant AND o.stops_at < v_run.to_instant_exclusive)
  ON CONFLICT DO NOTHING;
  UPDATE private.booqable_run_leases SET run_id = v_run.id
  WHERE lock_key = 'manual_sync' AND token = (v_lease->>'token')::uuid
    AND fence = (v_lease->>'fence')::bigint;
  RETURN private.dashboard_sync_payload(v_run, v_lease);
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_start_selected_sync(from_date date, to_date date)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.dashboard_start_selected_sync(from_date, to_date);
$$;

CREATE OR REPLACE FUNCTION private.dashboard_resume_selected_sync(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_lease jsonb; v_run public.booqable_sync_runs;
BEGIN
  v_denied := private.workshop_staff_or_forbidden();
  IF v_denied IS NOT NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run.id IS NULL OR v_run.scope IS DISTINCT FROM 'selected_period'
     OR v_run.policy_version IS DISTINCT FROM 1
     OR v_run.from_date IS NULL OR v_run.to_date IS NULL OR v_run.to_date < v_run.from_date
     OR v_run.from_instant IS DISTINCT FROM (v_run.from_date::timestamp AT TIME ZONE 'Europe/Madrid')
     OR v_run.to_instant_exclusive IS DISTINCT FROM ((v_run.to_date + 1)::timestamp AT TIME ZONE 'Europe/Madrid')
     OR v_run.discovery_phase IS NULL
     OR v_run.discovery_phase NOT IN ('starts_at', 'stops_at', 'reconcile')
     OR v_run.discovery_page IS NULL OR v_run.discovery_page < 1 THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Selected refresh cannot be resumed; start again.');
  END IF;
  IF v_run.state = 'succeeded' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh already completed.');
  END IF;
  v_lease := private.booqable_acquire_run_lease(
    'manual_sync', now() + interval '2 minutes',
    'staff:' || coalesce((SELECT auth.uid())::text, 'unknown'));
  IF coalesce(v_lease->>'ok', 'false') <> 'true' THEN RETURN v_lease; END IF;
  UPDATE public.booqable_sync_runs SET state = 'in_progress',
    attempt = attempt + CASE WHEN state = 'failed' THEN 1 ELSE 0 END,
    last_attempt_at = now(), updated_at = now()
  WHERE id = p_run_id RETURNING * INTO v_run;
  UPDATE private.booqable_run_leases SET run_id = v_run.id
  WHERE lock_key = 'manual_sync' AND token = (v_lease->>'token')::uuid
    AND fence = (v_lease->>'fence')::bigint;
  RETURN private.dashboard_sync_payload(v_run, v_lease);
END; $$;

-- Called by the authenticated action only when its backend worker cannot
-- continue after acquiring a run lease. The token, fence and owner bind the
-- caller to the current lease; a stale request cannot fail another run.
CREATE OR REPLACE FUNCTION private.dashboard_abort_selected_sync(
  p_run_id uuid, p_token uuid, p_fence bigint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_denied jsonb; v_owner text; v_run_id uuid;
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
  UPDATE public.booqable_sync_runs SET state = 'failed',
    last_error = left(coalesce(nullif(p_reason, ''), 'Refresh worker could not continue.'), 1000),
    finished_at = now(), last_attempt_at = now(), updated_at = now()
  WHERE id = v_run_id AND scope = 'selected_period' AND state = 'in_progress';
  PERFORM private.booqable_release_run_lease('manual_sync', p_token, p_fence);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_abort_selected_sync(
  run_id uuid, token uuid, fence bigint, reason text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.dashboard_abort_selected_sync(run_id, token, fence, reason);
$$;

CREATE OR REPLACE FUNCTION public.dashboard_resume_selected_sync(run_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.dashboard_resume_selected_sync(run_id);
$$;

CREATE OR REPLACE FUNCTION private.dashboard_sync_assert_lease(
  p_run_id uuid, p_token uuid, p_fence bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.booqable_run_leases l
    WHERE l.lock_key = 'manual_sync' AND l.run_id = p_run_id
      AND l.token = p_token AND l.fence = p_fence AND l.expires_at > now());
$$;

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
  IF v_run.scope <> 'selected_period' OR v_run.discovery_phase IS DISTINCT FROM phase
     OR v_run.discovery_page IS DISTINCT FROM page OR phase NOT IN ('starts_at', 'stops_at')
     OR has_more IS NULL OR candidate_ids IS NULL OR array_position(candidate_ids, NULL) IS NOT NULL THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh checkpoint mismatch.');
  END IF;
  INSERT INTO private.dashboard_sync_candidates (run_id, booqable_order_id)
  SELECT run_id, x FROM unnest(candidate_ids) AS x WHERE x <> ''
  ON CONFLICT DO NOTHING;
  UPDATE public.booqable_sync_runs SET
    discovery_phase = CASE WHEN has_more THEN phase
      WHEN phase = 'starts_at' THEN 'stops_at' ELSE 'reconcile' END,
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
  IF v_run.scope <> 'selected_period' OR v_run.discovery_phase <> 'reconcile'
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
  IF v_run.scope <> 'selected_period' OR v_run.discovery_phase <> 'reconcile'
     OR NOT EXISTS (SELECT 1 FROM private.dashboard_sync_candidates c
       WHERE c.run_id = $1 AND c.booqable_order_id = $4) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Unknown refresh candidate.');
  END IF;
  v_result := private.booqable_record_sync_result(run_id, booqable_order_id, ok, code, error, false);
  UPDATE public.booqable_sync_order_results r SET attempt = v_run.attempt
  WHERE r.run_id = $1 AND r.booqable_order_id = $4;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.dashboard_finish_selected_sync(
  run_id uuid, token uuid, fence bigint, listing_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run public.booqable_sync_runs; v_pending integer; v_failed integer; v_state text;
BEGIN
  IF NOT private.dashboard_sync_assert_lease(run_id, token, fence) THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Refresh lease expired.');
  END IF;
  SELECT * INTO v_run FROM public.booqable_sync_runs WHERE id = run_id FOR UPDATE;
  IF v_run.scope <> 'selected_period' THEN
    RETURN private.workshop_err('SOURCE_UNAVAILABLE', 'Unknown refresh run.');
  END IF;
  SELECT count(*)::integer INTO v_pending FROM private.dashboard_sync_candidates c
  LEFT JOIN public.booqable_sync_order_results r
    ON r.run_id = c.run_id AND r.booqable_order_id = c.booqable_order_id
  WHERE c.run_id = $1 AND (r.id IS NULL OR (NOT r.ok AND r.attempt < v_run.attempt));
  SELECT count(*)::integer INTO v_failed FROM public.booqable_sync_order_results r
  WHERE r.run_id = $1 AND NOT r.ok;
  v_state := CASE WHEN listing_error IS NOT NULL OR v_failed > 0 THEN 'failed'
    WHEN v_run.discovery_phase = 'reconcile' AND v_pending = 0 THEN 'succeeded'
    ELSE 'in_progress' END;
  UPDATE public.booqable_sync_runs SET state = v_state,
    last_error = CASE WHEN listing_error IS NOT NULL THEN listing_error
      WHEN v_failed > 0 THEN (SELECT error FROM public.booqable_sync_order_results
        WHERE booqable_sync_order_results.run_id = v_run.id AND NOT ok ORDER BY created_at DESC LIMIT 1)
      ELSE NULL END,
    last_attempt_at = now(), updated_at = now(),
    finished_at = CASE WHEN v_state IN ('succeeded', 'failed') THEN now() ELSE NULL END
  WHERE id = run_id RETURNING * INTO v_run;
  RETURN private.dashboard_sync_payload(v_run, NULL);
END; $$;

REVOKE ALL ON FUNCTION private.dashboard_sync_payload(public.booqable_sync_runs, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.dashboard_start_selected_sync(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.dashboard_resume_selected_sync(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.dashboard_abort_selected_sync(uuid, uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.dashboard_sync_assert_lease(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_start_selected_sync(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_resume_selected_sync(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_abort_selected_sync(uuid, uuid, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.dashboard_start_selected_sync(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION private.dashboard_resume_selected_sync(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.dashboard_abort_selected_sync(uuid, uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_start_selected_sync(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_resume_selected_sync(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_abort_selected_sync(uuid, uuid, bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.dashboard_checkpoint_selected_sync(uuid, uuid, bigint, text, integer, text[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_selected_sync_work(uuid, uuid, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_record_selected_result(uuid, uuid, bigint, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_finish_selected_sync(uuid, uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_checkpoint_selected_sync(uuid, uuid, bigint, text, integer, text[], boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_selected_sync_work(uuid, uuid, bigint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_record_selected_result(uuid, uuid, bigint, text, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_finish_selected_sync(uuid, uuid, bigint, text) TO service_role;

-- Workshop health must continue to describe only its reserved-list scopes.
CREATE OR REPLACE VIEW public.workshop_sync_health
WITH (security_invoker = true) AS
SELECT h.last_success_at, r.id AS run_id, r.scope, r.state, r.cursor,
  r.listed, r.succeeded, r.failed, r.skipped, r.last_error, r.last_attempt_at
FROM public.booqable_sync_health h
LEFT JOIN LATERAL (
  SELECT * FROM public.booqable_sync_runs
  WHERE scope IN ('next_7_days', 'all_reserved')
  ORDER BY last_attempt_at DESC, created_at DESC LIMIT 1
) r ON true
WHERE h.id = 'workshop';
