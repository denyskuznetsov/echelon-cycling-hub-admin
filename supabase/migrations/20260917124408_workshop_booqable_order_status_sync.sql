-- Automatic Workshop pickup/return from authoritative whole-order fulfillment.
-- Idempotent. Apply locally only.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS booqable_statuses jsonb,
  ADD COLUMN IF NOT EXISTS booqable_status_counts jsonb,
  ADD COLUMN IF NOT EXISTS workshop_fulfillment_state text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS workshop_fulfillment_evidence_observed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workshop_source_pickup_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workshop_source_return_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.bike_tasks
  ADD COLUMN IF NOT EXISTS workshop_source_pickup_observed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workshop_source_return_observed boolean NOT NULL DEFAULT false;

-- A partially-created local object must converge to the same shape on replay.
ALTER TABLE public.orders
  ALTER COLUMN workshop_fulfillment_state SET DEFAULT 'unknown',
  ALTER COLUMN workshop_fulfillment_evidence_observed SET DEFAULT false,
  ALTER COLUMN workshop_source_pickup_confirmed SET DEFAULT false,
  ALTER COLUMN workshop_source_return_confirmed SET DEFAULT false;
UPDATE public.orders
SET workshop_fulfillment_state = COALESCE(workshop_fulfillment_state, 'unknown'),
    workshop_fulfillment_evidence_observed = COALESCE(workshop_fulfillment_evidence_observed, false),
    workshop_source_pickup_confirmed = COALESCE(workshop_source_pickup_confirmed, false),
    workshop_source_return_confirmed = COALESCE(workshop_source_return_confirmed, false)
WHERE workshop_fulfillment_state IS NULL
   OR workshop_fulfillment_evidence_observed IS NULL
   OR workshop_source_pickup_confirmed IS NULL
   OR workshop_source_return_confirmed IS NULL;
ALTER TABLE public.orders
  ALTER COLUMN workshop_fulfillment_state SET NOT NULL,
  ALTER COLUMN workshop_fulfillment_evidence_observed SET NOT NULL,
  ALTER COLUMN workshop_source_pickup_confirmed SET NOT NULL,
  ALTER COLUMN workshop_source_return_confirmed SET NOT NULL;

ALTER TABLE public.bike_tasks
  ALTER COLUMN workshop_source_pickup_observed SET DEFAULT false,
  ALTER COLUMN workshop_source_return_observed SET DEFAULT false;
UPDATE public.bike_tasks
SET workshop_source_pickup_observed = COALESCE(workshop_source_pickup_observed, false),
    workshop_source_return_observed = COALESCE(workshop_source_return_observed, false)
WHERE workshop_source_pickup_observed IS NULL
   OR workshop_source_return_observed IS NULL;
ALTER TABLE public.bike_tasks
  ALTER COLUMN workshop_source_pickup_observed SET NOT NULL,
  ALTER COLUMN workshop_source_return_observed SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_booqable_statuses_array_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_booqable_statuses_array_check
  CHECK (booqable_statuses IS NULL OR jsonb_typeof(booqable_statuses) = 'array');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_booqable_status_counts_object_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_booqable_status_counts_object_check
  CHECK (
    booqable_status_counts IS NULL
    OR jsonb_typeof(booqable_status_counts) = 'object'
  );

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_workshop_fulfillment_state_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_workshop_fulfillment_state_check
  CHECK (workshop_fulfillment_state = ANY (ARRAY[
    'reserved', 'full_pickup', 'mixed', 'final_return', 'canceled', 'unknown'
  ]));

-- Preserve the original validator behind a wrapper so aggregate fields can be
-- optional (unknown pickup) but, when present, must be structurally trustworthy.
DO $$
BEGIN
  IF to_regprocedure('private.booqable_snapshot_error_inner(jsonb,text)') IS NULL
     AND to_regprocedure('private.booqable_snapshot_error(jsonb,text)') IS NOT NULL THEN
    ALTER FUNCTION private.booqable_snapshot_error(jsonb, text)
      RENAME TO booqable_snapshot_error_inner;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.booqable_snapshot_error(
  p_snapshot jsonb,
  p_booqable_order_id text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_error text;
BEGIN
  v_error := private.booqable_snapshot_error_inner(
    p_snapshot,
    p_booqable_order_id
  );
  IF v_error IS NOT NULL THEN
    RETURN v_error;
  END IF;

  IF p_snapshot->'order'->>'status' IS DISTINCT FROM p_snapshot->>'sourceStatus' THEN
    RETURN 'INVALID_SNAPSHOT';
  END IF;

  IF p_snapshot->'order' ? 'statuses'
     AND p_snapshot->'order'->'statuses' <> 'null'::jsonb THEN
    IF jsonb_typeof(p_snapshot->'order'->'statuses') IS DISTINCT FROM 'array' THEN
      RETURN 'INVALID_SNAPSHOT';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_snapshot->'order'->'statuses') AS s(value)
      WHERE jsonb_typeof(s.value) IS DISTINCT FROM 'string'
         OR btrim(s.value #>> '{}') = ''
    ) THEN
      RETURN 'INVALID_SNAPSHOT';
    END IF;
    IF (
      SELECT count(*)
      FROM jsonb_array_elements_text(p_snapshot->'order'->'statuses') AS s(value)
    ) IS DISTINCT FROM (
      SELECT count(DISTINCT s.value)
      FROM jsonb_array_elements_text(p_snapshot->'order'->'statuses') AS s(value)
    ) THEN
      RETURN 'INVALID_SNAPSHOT';
    END IF;
  END IF;

  IF p_snapshot->'order' ? 'statusCounts'
     AND p_snapshot->'order'->'statusCounts' <> 'null'::jsonb THEN
    IF jsonb_typeof(p_snapshot->'order'->'statusCounts') IS DISTINCT FROM 'object' THEN
      RETURN 'INVALID_SNAPSHOT';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_snapshot->'order'->'statusCounts') AS c(key, value)
      WHERE btrim(c.key) = ''
         OR jsonb_typeof(c.value) IS DISTINCT FROM 'number'
         OR (c.value #>> '{}') !~ '^[0-9]+$'
         OR CASE
              WHEN jsonb_typeof(c.value) = 'number'
               AND (c.value #>> '{}') ~ '^[0-9]+$'
                THEN (c.value #>> '{}')::numeric > 9223372036854775807::numeric
              ELSE false
            END
    ) THEN
      RETURN 'INVALID_SNAPSHOT';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.booqable_workshop_fulfillment_state(
  p_snapshot jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_source_status text := p_snapshot->>'sourceStatus';
  v_statuses jsonb := p_snapshot->'order'->'statuses';
  v_counts jsonb := p_snapshot->'order'->'statusCounts';
  v_status_keys text[];
  v_positive_keys text[];
BEGIN
  IF v_source_status = 'stopped' THEN
    RETURN 'final_return';
  END IF;
  IF v_source_status = 'canceled' THEN
    RETURN 'canceled';
  END IF;

  IF (v_statuses IS NULL OR v_statuses = 'null'::jsonb)
     AND (v_counts IS NULL OR v_counts = 'null'::jsonb) THEN
    IF v_source_status = ANY (ARRAY['reserved', 'new', 'draft']) THEN
      RETURN 'reserved';
    END IF;
    RETURN 'unknown';
  END IF;

  IF jsonb_typeof(v_statuses) IS DISTINCT FROM 'array'
     OR jsonb_typeof(v_counts) IS DISTINCT FROM 'object' THEN
    RETURN 'unknown';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT s.value ORDER BY s.value), '{}')
  INTO v_status_keys
  FROM jsonb_array_elements_text(v_statuses) AS s(value);

  SELECT COALESCE(array_agg(c.key ORDER BY c.key), '{}')
  INTO v_positive_keys
  FROM jsonb_each(v_counts) AS c(key, value)
  WHERE CASE
    WHEN jsonb_typeof(c.value) = 'number'
     AND (c.value #>> '{}') ~ '^[0-9]+$'
     AND (c.value #>> '{}')::numeric <= 9223372036854775807::numeric
      THEN (c.value #>> '{}')::numeric > 0
    ELSE false
  END;

  IF cardinality(v_status_keys) = 0
     OR v_status_keys IS DISTINCT FROM v_positive_keys
     OR NOT (v_source_status = ANY (v_status_keys)) THEN
    RETURN 'unknown';
  END IF;

  IF v_source_status = ANY (ARRAY['reserved', 'new', 'draft'])
     AND v_status_keys = ARRAY[v_source_status]::text[] THEN
    RETURN 'reserved';
  END IF;

  IF v_source_status = 'started'
     AND v_status_keys = ARRAY['started']::text[]
     AND COALESCE((v_counts->>'started')::bigint, 0) > 0 THEN
    RETURN 'full_pickup';
  END IF;

  RETURN 'mixed';
END;
$$;

-- Aggregate fulfillment is source evidence, so include it in the canonical
-- source fingerprint used on source-attributed task events.
CREATE OR REPLACE FUNCTION private.booqable_source_fingerprint(p_snapshot jsonb)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT private.booqable_sha256(
    jsonb_build_object(
      'v', 2,
      'starts_at', p_snapshot->'order'->>'startsAt',
      'status', p_snapshot->>'sourceStatus',
      'statuses', CASE
        WHEN jsonb_typeof(p_snapshot->'order'->'statuses') = 'array' THEN
          COALESCE((
            SELECT jsonb_agg(s.value ORDER BY s.value)
            FROM jsonb_array_elements_text(p_snapshot->'order'->'statuses') AS s(value)
          ), '[]'::jsonb)
        ELSE p_snapshot->'order'->'statuses'
      END,
      'status_counts', p_snapshot->'order'->'statusCounts',
      'assignments', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'sip_id', a->>'sipId',
            'stock_item_id', a->>'stockItemId',
            'tag_list', COALESCE((
              SELECT jsonb_agg(tag ORDER BY tag)
              FROM jsonb_array_elements_text(
                COALESCE(a->'workshopTags', '[]'::jsonb)
              ) AS tag
            ), '[]'::jsonb)
          )
          ORDER BY a->>'stockItemId', a->>'sipId'
        )
        FROM jsonb_array_elements(
          COALESCE(p_snapshot->'assignments', '[]'::jsonb)
        ) AS a
      ), '[]'::jsonb)
    )
  );
$$;

-- The existing apply owns the lock order and assignment set-diff. Wrap it to
-- provide the current classification to retained-task reconciliation and then
-- persist the raw evidence only after the complete apply succeeds.
DO $$
BEGIN
  IF to_regprocedure(
       'private.booqable_apply_source_snapshot_v1_inner(text,uuid,bigint,jsonb)'
     ) IS NULL
     AND to_regprocedure(
       'private.booqable_apply_source_snapshot_v1(text,uuid,bigint,jsonb)'
     ) IS NOT NULL THEN
    ALTER FUNCTION private.booqable_apply_source_snapshot_v1(
      text, uuid, bigint, jsonb
    ) RENAME TO booqable_apply_source_snapshot_v1_inner;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.booqable_apply_source_snapshot_v1(
  p_booqable_order_id text,
  p_token uuid,
  p_fence bigint,
  p_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_state text;
BEGIN
  v_state := private.booqable_workshop_fulfillment_state(p_snapshot);
  PERFORM pg_catalog.set_config(
    'booqable.workshop_fulfillment_state',
    v_state,
    true
  );

  v_result := private.booqable_apply_source_snapshot_v1_inner(
    p_booqable_order_id,
    p_token,
    p_fence,
    p_snapshot
  );

  IF COALESCE((v_result->>'ok')::boolean, false) THEN
    UPDATE public.orders
    SET booqable_statuses = NULLIF(p_snapshot->'order'->'statuses', 'null'::jsonb),
        booqable_status_counts = NULLIF(p_snapshot->'order'->'statusCounts', 'null'::jsonb),
        workshop_fulfillment_state = v_state,
        workshop_fulfillment_evidence_observed = true,
        workshop_source_pickup_confirmed =
          workshop_source_pickup_confirmed OR v_state = 'full_pickup',
        workshop_source_return_confirmed =
          workshop_source_return_confirmed OR v_state = 'final_return'
    WHERE booqable_order_id = p_booqable_order_id;
  END IF;

  RETURN v_result || jsonb_build_object('fulfillmentState', v_state);
END;
$$;

-- This is the latest retained-task implementation plus the two source-driven
-- guarded forward edges. New tasks are created later in the apply and therefore
-- always begin at To Prepare, even for already-started/stopped orders.
CREATE OR REPLACE FUNCTION private.booqable_sync_retained_task(
  p_order public.orders,
  p_instance public.booqable_assignment_instances,
  p_assignment jsonb,
  p_fingerprint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.bike_tasks;
  v_tag private.booqable_tag_resolution;
  v_has_prep boolean;
  v_from public.bike_task_status;
  v_source_state text := COALESCE(
    pg_catalog.current_setting('booqable.workshop_fulfillment_state', true),
    'unknown'
  );
BEGIN
  v_tag := private.booqable_resolve_workshop_tag(p_assignment->'workshopTags');

  UPDATE public.booqable_assignment_instances
  SET booqable_stock_item_planning_id = p_assignment->>'sipId',
      bike_display_id = p_assignment->>'displayId',
      bike_title = p_assignment->>'title',
      booqable_line_id = COALESCE(
        NULLIF(btrim(p_assignment->>'booqableLineId'), ''),
        public.booqable_assignment_instances.booqable_line_id
      )
  WHERE id = p_instance.id;

  SELECT * INTO v_task
  FROM public.bike_tasks t
  WHERE t.assignment_instance_id = p_instance.id
    AND t.status <> ALL (ARRAY[
      'completed'::public.bike_task_status,
      'cancelled'::public.bike_task_status
    ])
  FOR UPDATE;

  IF v_task.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.bike_tasks
  SET order_number = p_order.order_number,
      starts_at = p_order.starts_at,
      bike_display_id = p_assignment->>'displayId',
      bike_title = p_assignment->>'title',
      workshop_tag = v_tag.workshop_tag,
      updated_at = now()
  WHERE id = v_task.id;

  IF v_task.status = 'to_prepare'::public.bike_task_status THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.bike_task_items i
      WHERE i.task_id = v_task.id
        AND i.stage = 'preparation'::public.bike_task_item_stage
    ) INTO v_has_prep;

    IF v_tag.definition_id IS NOT NULL AND NOT v_tag.has_warning THEN
      IF v_task.selected_definition_id IS DISTINCT FROM v_tag.definition_id
         OR NOT v_has_prep THEN
        PERFORM private.workshop_replace_preparation_items(
          v_task.id,
          v_tag.definition_id
        );
        v_from := v_task.status;
        v_task := private.workshop_bump_task(v_task.id, v_task.status);
        UPDATE public.bike_tasks
        SET selected_definition_id = v_tag.definition_id,
            has_configuration_warning = false
        WHERE id = v_task.id;
        PERFORM private.workshop_record_event(
          v_task.id, 'checklist_changed', v_from, v_task.status,
          v_task.version, NULL, NULL, NULL, p_fingerprint, 'source_apply'
        );
      ELSE
        UPDATE public.bike_tasks
        SET has_configuration_warning = false,
            selected_definition_id = v_tag.definition_id
        WHERE id = v_task.id;
      END IF;
    ELSE
      IF v_has_prep OR v_task.selected_definition_id IS NOT NULL THEN
        PERFORM private.workshop_replace_preparation_items(v_task.id, NULL);
        v_from := v_task.status;
        v_task := private.workshop_bump_task(v_task.id, v_task.status);
        UPDATE public.bike_tasks
        SET selected_definition_id = NULL,
            has_configuration_warning = true
        WHERE id = v_task.id;
        PERFORM private.workshop_record_event(
          v_task.id, 'checklist_changed', v_from, v_task.status,
          v_task.version, NULL, NULL, NULL, p_fingerprint, 'source_apply'
        );
      ELSE
        UPDATE public.bike_tasks
        SET has_configuration_warning = true,
            selected_definition_id = NULL
        WHERE id = v_task.id;
      END IF;
    END IF;
  ELSE
    UPDATE public.bike_tasks
    SET has_configuration_warning = CASE
          WHEN v_tag.has_warning THEN true
          WHEN v_tag.definition_id IS DISTINCT FROM v_task.selected_definition_id THEN true
          ELSE has_configuration_warning
        END
    WHERE id = v_task.id;
  END IF;

  IF v_source_state = 'full_pickup'
     AND v_task.status = 'ready_for_pickup'::public.bike_task_status THEN
    v_from := v_task.status;
    v_task := private.workshop_bump_task(
      v_task.id,
      'in_rental'::public.bike_task_status
    );
    UPDATE public.bike_tasks
    SET workshop_source_pickup_observed = true
    WHERE id = v_task.id;
    PERFORM private.workshop_record_event(
      v_task.id, 'transition', v_from, v_task.status, v_task.version,
      NULL, NULL, NULL, p_fingerprint, 'source_apply'
    );
  ELSIF v_source_state = 'final_return'
        AND v_task.status = 'in_rental'::public.bike_task_status THEN
    v_from := v_task.status;
    v_task := private.workshop_bump_task(
      v_task.id,
      'returned'::public.bike_task_status
    );
    UPDATE public.bike_tasks
    SET workshop_source_return_observed = true
    WHERE id = v_task.id;
    PERFORM private.workshop_record_event(
      v_task.id, 'transition', v_from, v_task.status, v_task.version,
      NULL, NULL, NULL, p_fingerprint, 'source_apply'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.workshop_task_source_notice(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.bike_tasks;
  v_order public.orders;
BEGIN
  SELECT * INTO v_task FROM public.bike_tasks WHERE id = p_task_id;
  IF v_task.id IS NULL
     OR v_task.status = ANY (ARRAY[
       'completed'::public.bike_task_status,
       'cancelled'::public.bike_task_status
     ]) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_task.order_id;

  IF v_order.workshop_fulfillment_state = 'mixed'
     AND v_task.status <> ALL (ARRAY[
       'returned'::public.bike_task_status,
       'prepare_for_storage'::public.bike_task_status
     ]) THEN
    RETURN jsonb_build_object(
      'kind', 'mixed',
      'title', 'Partial Booqable pickup or return',
      'description', 'This Booqable order has partial pickups or returns. Update this task manually.'
    );
  END IF;

  IF v_order.workshop_fulfillment_evidence_observed
     AND v_order.workshop_fulfillment_state = 'unknown'
     AND v_task.status <> ALL (ARRAY[
       'returned'::public.bike_task_status,
       'prepare_for_storage'::public.bike_task_status
     ]) THEN
    RETURN jsonb_build_object(
      'kind', 'unknown',
      'title', 'Booqable pickup could not be confirmed',
      'description', 'Automation could not establish that this whole Booqable order was picked up. Update this task manually or sync again after the order is complete.'
    );
  END IF;

  IF v_order.workshop_fulfillment_state = 'full_pickup'
     AND v_task.status = ANY (ARRAY[
       'to_prepare'::public.bike_task_status,
       'being_prepared'::public.bike_task_status,
       'needs_recheck'::public.bike_task_status
     ]) THEN
    RETURN jsonb_build_object(
      'kind', 'not_ready',
      'title', 'Booqable pickup is ahead of Workshop',
      'description', 'Booqable marks this order as picked up. Finish the checks, then sync again or mark this task as picked up.'
    );
  END IF;

  IF v_order.workshop_fulfillment_state = 'final_return'
     AND v_task.status = ANY (ARRAY[
       'to_prepare'::public.bike_task_status,
       'being_prepared'::public.bike_task_status,
       'needs_recheck'::public.bike_task_status,
       'ready_for_pickup'::public.bike_task_status
     ]) THEN
    RETURN jsonb_build_object(
      'kind', 'missed_pickup',
      'title', 'Booqable return is ahead of Workshop',
      'description', 'Booqable marks this order as returned, but Workshop never recorded pickup. Use the normal manual pickup and return actions to recover this task.'
    );
  END IF;

  IF (
       v_task.status = 'in_rental'::public.bike_task_status
       AND v_task.workshop_source_pickup_observed
       AND v_order.workshop_fulfillment_state = 'reserved'
     ) OR (
       v_task.status = ANY (ARRAY[
         'returned'::public.bike_task_status,
         'prepare_for_storage'::public.bike_task_status
       ])
       AND (
         (
           v_task.workshop_source_return_observed
           AND v_order.workshop_fulfillment_state = ANY (ARRAY['reserved', 'full_pickup'])
         )
         OR (
           v_task.workshop_source_pickup_observed
           AND v_order.workshop_fulfillment_state = 'reserved'
         )
       )
     ) THEN
    RETURN jsonb_build_object(
      'kind', 'reversal',
      'title', 'Booqable status moved backward',
      'description', 'Booqable now shows an earlier fulfillment state. Workshop progress was preserved; review the order and update this task manually if needed.'
    );
  END IF;

  IF v_order.workshop_fulfillment_state = 'reserved'
     AND v_task.status = ANY (ARRAY[
       'in_rental'::public.bike_task_status,
       'returned'::public.bike_task_status,
       'prepare_for_storage'::public.bike_task_status
     ]) THEN
    RETURN jsonb_build_object(
      'kind', 'local_ahead',
      'title', 'Workshop is ahead of Booqable',
      'description', 'This task was advanced manually while Booqable still shows the order as reserved. Review the order and continue with the normal manual actions.'
    );
  END IF;

  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('private.workshop_task_detail_inner(uuid)') IS NULL
     AND to_regprocedure('private.workshop_task_detail(uuid)') IS NOT NULL THEN
    ALTER FUNCTION private.workshop_task_detail(uuid)
      RENAME TO workshop_task_detail_inner;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.workshop_task_detail(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_detail jsonb;
BEGIN
  v_detail := private.workshop_task_detail_inner(p_task_id);
  IF v_detail IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_detail || jsonb_build_object(
    'sourceNotice', private.workshop_task_source_notice(p_task_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.booqable_snapshot_error_inner(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.booqable_snapshot_error(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.booqable_workshop_fulfillment_state(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.booqable_apply_source_snapshot_v1_inner(
  text, uuid, bigint, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.booqable_apply_source_snapshot_v1(
  text, uuid, bigint, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.booqable_sync_retained_task(
  public.orders, public.booqable_assignment_instances, jsonb, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.workshop_task_source_notice(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.workshop_task_detail_inner(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.workshop_task_detail(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.booqable_snapshot_error_inner(jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION private.booqable_snapshot_error(jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION private.booqable_workshop_fulfillment_state(jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION private.booqable_apply_source_snapshot_v1_inner(
  text, uuid, bigint, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION private.booqable_apply_source_snapshot_v1(
  text, uuid, bigint, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION private.booqable_sync_retained_task(
  public.orders, public.booqable_assignment_instances, jsonb, text
) TO service_role;
GRANT EXECUTE ON FUNCTION private.workshop_task_detail(uuid) TO authenticated;
