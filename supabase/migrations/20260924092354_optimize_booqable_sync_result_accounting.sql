-- Maintain run totals from the old and new category of one order result.
-- The run row serializes concurrent recorders; no accumulated-result recount
-- is needed after each order. Idempotent. Apply locally only.

-- This function rejects retired all_reserved execution. Wait for any old
-- worker with a live run lease before replacing the function it may still use.
LOCK TABLE private.booqable_run_leases IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.booqable_sync_runs r
    JOIN private.booqable_run_leases l ON l.run_id = r.id
    WHERE l.lock_key = 'manual_sync' AND l.expires_at > now()
      AND r.scope = 'all_reserved' AND r.state = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'An all_reserved worker still holds the run lease; retry this migration after it finishes or expires';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.booqable_record_sync_result(
  p_run_id uuid,
  p_booqable_order_id text,
  p_ok boolean,
  p_code text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_skipped boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.booqable_sync_runs;
  v_old_ok boolean;
  v_old_skipped boolean;
  v_had_result boolean;
BEGIN
  SELECT * INTO v_run
  FROM public.booqable_sync_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF v_run.id IS NULL THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'Sync run not found.');
  END IF;

  IF v_run.scope = 'all_reserved' THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'all_reserved sync scope is retired.');
  END IF;

  IF v_run.state <> 'in_progress' THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'Sync run is no longer active.');
  END IF;

  IF p_ok IS NULL OR p_skipped IS NULL OR (p_skipped AND NOT p_ok) THEN
    RETURN private.booqable_err('SOURCE_UNAVAILABLE', 'Invalid sync result.');
  END IF;

  SELECT ok, skipped INTO v_old_ok, v_old_skipped
  FROM public.booqable_sync_order_results
  WHERE run_id = p_run_id AND booqable_order_id = p_booqable_order_id;
  v_had_result := FOUND;

  INSERT INTO public.booqable_sync_order_results (
    run_id, booqable_order_id, ok, code, error, skipped
  ) VALUES (
    p_run_id, p_booqable_order_id, p_ok, p_code, p_error, p_skipped
  )
  ON CONFLICT (run_id, booqable_order_id)
  DO UPDATE SET
    ok = EXCLUDED.ok,
    code = EXCLUDED.code,
    error = EXCLUDED.error,
    skipped = EXCLUDED.skipped,
    created_at = clock_timestamp();

  UPDATE public.booqable_sync_runs
  SET listed = listed + CASE WHEN v_had_result THEN 0 ELSE 1 END,
      succeeded = succeeded
        - CASE WHEN v_had_result AND v_old_ok AND NOT v_old_skipped THEN 1 ELSE 0 END
        + CASE WHEN p_ok AND NOT p_skipped THEN 1 ELSE 0 END,
      failed = failed
        - CASE WHEN v_had_result AND NOT v_old_ok AND NOT v_old_skipped THEN 1 ELSE 0 END
        + CASE WHEN NOT p_ok AND NOT p_skipped THEN 1 ELSE 0 END,
      skipped = skipped
        - CASE WHEN v_had_result AND v_old_skipped THEN 1 ELSE 0 END
        + CASE WHEN p_skipped THEN 1 ELSE 0 END,
      last_error = CASE WHEN p_ok THEN last_error ELSE coalesce(p_error, last_error) END,
      last_attempt_at = now(),
      updated_at = now()
  WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION private.booqable_record_sync_result(uuid, text, boolean, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.booqable_record_sync_result(uuid, text, boolean, text, text, boolean)
  TO service_role;
