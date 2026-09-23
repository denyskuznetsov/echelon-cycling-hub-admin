-- Staff dashboard workload read. Idempotent; apply locally only.
-- The function deliberately starts from the canonical orders table because the
-- legacy bookings_view excludes rows without an order number, which must remain
-- visible to staff on this dashboard.

CREATE OR REPLACE FUNCTION public.dashboard_workload(
  p_from_date date,
  p_to_date date,
  p_reference_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_role public.user_role;
  v_from timestamptz;
  v_to_exclusive timestamptz;
BEGIN
  v_role := public.get_user_role();
  IF v_role IS NULL OR v_role NOT IN (
    'admin'::public.user_role,
    'manager'::public.user_role,
    'mechanic'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Dashboard workload is restricted to staff' USING ERRCODE = '42501';
  END IF;

  IF p_from_date IS NULL OR p_to_date IS NULL OR p_reference_at IS NULL
     OR p_to_date < p_from_date THEN
    RAISE EXCEPTION 'Dashboard workload requires an inclusive valid date range' USING ERRCODE = '22007';
  END IF;

  -- Date arithmetic happens in Madrid independently for each boundary. This
  -- keeps a local inclusive date range correct on either DST transition.
  v_from := p_from_date::timestamp AT TIME ZONE 'Europe/Madrid';
  v_to_exclusive := (p_to_date + 1)::timestamp AT TIME ZONE 'Europe/Madrid';

  RETURN (
    WITH eligible_orders AS (
      SELECT
        o.id,
        o.order_number,
        o.status::text AS order_status,
        o.fulfillment_type::text AS fulfillment_type,
        o.starts_at,
        o.stops_at,
        c.name AS customer_name,
        CASE
          WHEN o.fulfillment_type <> 'delivery'::public.fulfillment_type
            OR o.fulfillment_type IS NULL THEN 'none'
          WHEN NULLIF(btrim(o.delivery_address, E' \t\n\r\f\v'), '') IS NOT NULL THEN 'address'
          WHEN NULLIF(btrim(o.maps_link_order, E' \t\n\r\f\v'), '') IS NOT NULL THEN 'maps'
          ELSE 'missing'
        END AS delivery_kind,
        CASE WHEN o.fulfillment_type = 'delivery'::public.fulfillment_type THEN
          COALESCE(
            NULLIF(btrim(o.delivery_address, E' \t\n\r\f\v'), ''),
            NULLIF(btrim(o.maps_link_order, E' \t\n\r\f\v'), '')
          )
        END AS delivery_value
      FROM public.orders o
      LEFT JOIN public.customers c ON c.id = o.customer_id
      WHERE o.status = ANY (ARRAY[
        'reserved'::public.order_status,
        'started'::public.order_status,
        'stopped'::public.order_status
      ])
    ),
    current_tasks AS (
      SELECT
        t.order_id,
        COALESCE(sum(t.count), 0)::integer AS task_count,
        COALESCE(sum(t.count) FILTER (WHERE t.status = 'ready_for_pickup'::public.bike_task_status), 0)::integer AS ready_task_count,
        COALESCE(sum(t.warning_count), 0)::integer AS configuration_warning_count,
        COALESCE(sum(t.source_mixed_count), 0)::integer AS source_mixed_count,
        COALESCE(sum(t.source_unknown_count), 0)::integer AS source_unknown_count,
        COALESCE(sum(t.source_pickup_ahead_count), 0)::integer AS source_pickup_ahead_count,
        COALESCE(sum(t.source_local_ahead_count), 0)::integer AS source_local_ahead_count,
        COALESCE(sum(t.source_reversal_count), 0)::integer AS source_reversal_count,
        COALESCE(sum(t.source_missed_pickup_count), 0)::integer AS source_missed_pickup_count,
        COALESCE(sum(t.count) FILTER (WHERE t.status = ANY (ARRAY[
          'to_prepare'::public.bike_task_status,
          'being_prepared'::public.bike_task_status,
          'needs_recheck'::public.bike_task_status
        ])), 0)::integer AS preparation_task_count,
        COALESCE(jsonb_object_agg(t.status::text, t.count), '{}'::jsonb) AS lifecycle_counts
      FROM (
        SELECT t.order_id, t.status, count(*)::integer AS count,
          count(*) FILTER (WHERE t.has_configuration_warning)::integer AS warning_count,
          count(*) FILTER (WHERE n.kind = 'mixed')::integer AS source_mixed_count,
          count(*) FILTER (WHERE n.kind = 'unknown')::integer AS source_unknown_count,
          count(*) FILTER (WHERE n.kind = 'not_ready')::integer AS source_pickup_ahead_count,
          count(*) FILTER (WHERE n.kind = 'missed_pickup')::integer AS source_missed_pickup_count,
          count(*) FILTER (WHERE n.kind = 'reversal')::integer AS source_reversal_count,
          count(*) FILTER (WHERE n.kind = 'local_ahead')::integer AS source_local_ahead_count
        FROM public.bike_tasks t
        JOIN public.orders o ON o.id = t.order_id
        JOIN public.booqable_assignment_instances ai
          ON ai.id = t.assignment_instance_id
         AND ai.order_id = t.order_id
        CROSS JOIN LATERAL (
          SELECT CASE
            -- Keep the precedence and task predicates of private.workshop_task_source_notice.
            WHEN o.workshop_fulfillment_state = 'mixed'
              AND t.status NOT IN ('returned'::public.bike_task_status, 'prepare_for_storage'::public.bike_task_status, 'completed'::public.bike_task_status)
              THEN 'mixed'
            WHEN o.workshop_fulfillment_evidence_observed AND o.workshop_fulfillment_state = 'unknown'
              AND t.status NOT IN ('returned'::public.bike_task_status, 'prepare_for_storage'::public.bike_task_status, 'completed'::public.bike_task_status)
              THEN 'unknown'
            WHEN o.workshop_fulfillment_state = 'full_pickup'
              AND t.status IN ('to_prepare'::public.bike_task_status, 'being_prepared'::public.bike_task_status, 'needs_recheck'::public.bike_task_status)
              THEN 'not_ready'
            WHEN o.workshop_fulfillment_state = 'final_return'
              AND t.status IN ('to_prepare'::public.bike_task_status, 'being_prepared'::public.bike_task_status,
                'needs_recheck'::public.bike_task_status, 'ready_for_pickup'::public.bike_task_status)
              THEN 'missed_pickup'
            WHEN (t.status = 'in_rental'::public.bike_task_status AND t.workshop_source_pickup_observed AND o.workshop_fulfillment_state = 'reserved')
              OR (t.status IN ('returned'::public.bike_task_status, 'prepare_for_storage'::public.bike_task_status)
                AND ((t.workshop_source_return_observed AND o.workshop_fulfillment_state IN ('reserved', 'full_pickup'))
                  OR (t.workshop_source_pickup_observed AND o.workshop_fulfillment_state = 'reserved')))
              THEN 'reversal'
            WHEN o.workshop_fulfillment_state = 'reserved'
              AND t.status IN ('in_rental'::public.bike_task_status, 'returned'::public.bike_task_status, 'prepare_for_storage'::public.bike_task_status)
              THEN 'local_ahead'
          END AS kind
        ) n
        WHERE ai.closed_at IS NULL
          AND t.task_kind = 'rental_turnaround'
          AND t.status <> 'cancelled'::public.bike_task_status
        GROUP BY t.order_id, t.status
      ) t
      GROUP BY t.order_id
    ),
    directional_rows AS (
      SELECT
        'outgoing'::text AS direction,
        o.starts_at AS scheduled_at,
        (o.starts_at AT TIME ZONE 'Europe/Madrid')::date AS local_date,
        CASE WHEN (o.starts_at AT TIME ZONE 'Europe/Madrid')::date = (p_reference_at AT TIME ZONE 'Europe/Madrid')::date
          THEN floor(extract(epoch FROM (o.starts_at - p_reference_at)) / 60)::integer
        END AS minutes_from_reference,
        o.id AS order_id,
        o.order_number,
        o.customer_name,
        o.order_status,
        o.fulfillment_type,
        o.delivery_kind,
        o.delivery_value,
        COALESCE(t.task_count, 0) AS task_count,
        COALESCE(t.ready_task_count, 0) AS ready_task_count,
        COALESCE(t.preparation_task_count, 0) AS preparation_task_count,
        COALESCE(t.configuration_warning_count, 0) AS configuration_warning_count,
        COALESCE(t.source_mixed_count, 0) AS source_mixed_count,
        COALESCE(t.source_unknown_count, 0) AS source_unknown_count,
        COALESCE(t.source_pickup_ahead_count, 0) AS source_pickup_ahead_count,
        COALESCE(t.source_local_ahead_count, 0) AS source_local_ahead_count,
        COALESCE(t.source_reversal_count, 0) AS source_reversal_count,
        COALESCE(t.source_missed_pickup_count, 0) AS source_missed_pickup_count,
        COALESCE(t.lifecycle_counts, '{}'::jsonb) AS lifecycle_counts
      FROM eligible_orders o
      LEFT JOIN current_tasks t ON t.order_id = o.id
      WHERE o.starts_at >= v_from AND o.starts_at < v_to_exclusive

      UNION ALL

      SELECT
        'incoming'::text AS direction,
        o.stops_at AS scheduled_at,
        (o.stops_at AT TIME ZONE 'Europe/Madrid')::date AS local_date,
        CASE WHEN (o.stops_at AT TIME ZONE 'Europe/Madrid')::date = (p_reference_at AT TIME ZONE 'Europe/Madrid')::date
          THEN floor(extract(epoch FROM (o.stops_at - p_reference_at)) / 60)::integer
        END AS minutes_from_reference,
        o.id AS order_id,
        o.order_number,
        o.customer_name,
        o.order_status,
        o.fulfillment_type,
        o.delivery_kind,
        o.delivery_value,
        COALESCE(t.task_count, 0) AS task_count,
        COALESCE(t.ready_task_count, 0) AS ready_task_count,
        COALESCE(t.preparation_task_count, 0) AS preparation_task_count,
        COALESCE(t.configuration_warning_count, 0) AS configuration_warning_count,
        COALESCE(t.source_mixed_count, 0) AS source_mixed_count,
        COALESCE(t.source_unknown_count, 0) AS source_unknown_count,
        COALESCE(t.source_pickup_ahead_count, 0) AS source_pickup_ahead_count,
        COALESCE(t.source_local_ahead_count, 0) AS source_local_ahead_count,
        COALESCE(t.source_reversal_count, 0) AS source_reversal_count,
        COALESCE(t.source_missed_pickup_count, 0) AS source_missed_pickup_count,
        COALESCE(t.lifecycle_counts, '{}'::jsonb) AS lifecycle_counts
      FROM eligible_orders o
      LEFT JOIN current_tasks t ON t.order_id = o.id
      WHERE o.stops_at >= v_from AND o.stops_at < v_to_exclusive
    ),
    condition_rows_raw AS (
      SELECT r.*,
        (
          CASE WHEN r.direction = 'outgoing' AND r.preparation_task_count > 0
                     AND r.local_date = (p_reference_at AT TIME ZONE 'Europe/Madrid')::date
            THEN jsonb_build_array(jsonb_build_object(
              'kind', 'preparation',
              'severity', CASE WHEN r.scheduled_at - p_reference_at <= interval '2 hours' THEN 'critical'
                               WHEN r.scheduled_at - p_reference_at <= interval '6 hours' THEN 'warning'
                               ELSE 'low' END,
              'affected_bikes', r.preparation_task_count))
            ELSE '[]'::jsonb END
          || CASE WHEN r.direction = 'outgoing' AND r.delivery_kind = 'missing' THEN jsonb_build_array(jsonb_build_object(
              'kind', 'missing_delivery_address',
              'severity', CASE WHEN r.local_date = (p_reference_at AT TIME ZONE 'Europe/Madrid')::date THEN 'critical'
                               WHEN r.local_date = ((p_reference_at AT TIME ZONE 'Europe/Madrid')::date + 1) THEN 'warning'
                               ELSE 'low' END,
              'affected_bikes', 0)) ELSE '[]'::jsonb END
          || CASE WHEN r.configuration_warning_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'configuration_warning', 'severity', 'warning',
              'affected_bikes', r.configuration_warning_count)) ELSE '[]'::jsonb END
          || CASE WHEN r.source_mixed_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'source_mixed', 'severity', 'warning', 'affected_bikes', r.source_mixed_count)) ELSE '[]'::jsonb END
          || CASE WHEN r.source_unknown_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'source_unknown', 'severity', 'warning', 'affected_bikes', r.source_unknown_count)) ELSE '[]'::jsonb END
          || CASE WHEN r.source_pickup_ahead_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'source_pickup_ahead', 'severity', 'warning', 'affected_bikes', r.source_pickup_ahead_count)) ELSE '[]'::jsonb END
          || CASE WHEN r.source_missed_pickup_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'source_missed_pickup', 'severity', 'warning', 'affected_bikes', r.source_missed_pickup_count)) ELSE '[]'::jsonb END
          || CASE WHEN r.source_reversal_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'source_reversal', 'severity', 'warning', 'affected_bikes', r.source_reversal_count)) ELSE '[]'::jsonb END
          || CASE WHEN r.source_local_ahead_count > 0 THEN jsonb_build_array(jsonb_build_object(
              'kind', 'source_local_ahead', 'severity', 'warning', 'affected_bikes', r.source_local_ahead_count)) ELSE '[]'::jsonb END
        ) AS unsorted_conditions
      FROM directional_rows r
    ),
    condition_rows AS (
      SELECT raw.*,
        COALESCE((SELECT jsonb_agg(c.condition ORDER BY
          CASE c.condition->>'severity' WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
          c.condition->>'kind')
          FROM jsonb_array_elements(raw.unsorted_conditions) AS c(condition)), '[]'::jsonb) AS conditions
      FROM condition_rows_raw raw
    ),
    attention_events AS (
      SELECT DISTINCT ON (r.order_id, c.kind)
        r.order_id, c.kind, c.severity, c.affected_bikes
      FROM condition_rows r
      CROSS JOIN LATERAL jsonb_to_recordset(r.conditions) AS c(kind text, severity text, affected_bikes integer)
      ORDER BY r.order_id, c.kind,
        CASE c.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        c.affected_bikes DESC
    ),
    attention_conditions AS (
      SELECT kind, severity,
        count(*)::integer AS orders,
        sum(affected_bikes)::integer AS affected_bikes
      FROM attention_events
      GROUP BY kind, severity
    ),
    day_groups AS (
      SELECT
        r.direction,
        r.local_date,
        jsonb_agg(
          jsonb_build_object(
            'order_id', r.order_id,
            'scheduled_at', r.scheduled_at,
            'minutes_from_reference', r.minutes_from_reference,
            'order_number', r.order_number,
            'customer_name', r.customer_name,
            'order_status', r.order_status,
            'fulfillment_type', r.fulfillment_type,
            'delivery_kind', r.delivery_kind,
            'delivery_value', r.delivery_value,
            'task_count', r.task_count,
            'ready_task_count', r.ready_task_count,
            'preparation_task_count', r.preparation_task_count,
            'lifecycle_counts', r.lifecycle_counts,
            'conditions', r.conditions
          )
          ORDER BY r.scheduled_at, r.order_number NULLS LAST, r.order_id
        ) AS rows
      FROM condition_rows r
      GROUP BY r.direction, r.local_date
    ),
    directional_payload AS (
      SELECT
        d.direction,
        jsonb_build_object(
          'days', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('date', g.local_date, 'rows', g.rows) ORDER BY g.local_date)
            FROM day_groups g WHERE g.direction = d.direction
          ), '[]'::jsonb),
          'totals', jsonb_build_object(
            'orders', count(r.order_id),
            'bikes', COALESCE(sum(r.task_count), 0),
            'deliveries', count(r.order_id) FILTER (WHERE r.delivery_kind IN ('address', 'maps', 'missing')),
            'missing_delivery_addresses', count(r.order_id) FILTER (WHERE r.delivery_kind = 'missing'),
            'outstanding_preparation', CASE
              WHEN d.direction = 'outgoing' THEN COALESCE(sum(r.preparation_task_count), 0)
              ELSE 0
            END
          )
        ) AS payload
      FROM (VALUES ('outgoing'::text), ('incoming'::text)) AS d(direction)
      LEFT JOIN directional_rows r ON r.direction = d.direction
      GROUP BY d.direction
    )
    SELECT jsonb_build_object(
      'reference_at', p_reference_at,
      'from_date', p_from_date,
      'to_date', p_to_date,
      'attention', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'kind', kind, 'severity', severity, 'orders', orders, 'affected_bikes', affected_bikes)
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, kind)
        FROM attention_conditions), '[]'::jsonb),
      'outgoing', (SELECT payload FROM directional_payload WHERE direction = 'outgoing'),
      'incoming', (SELECT payload FROM directional_payload WHERE direction = 'incoming')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_workload(date, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_workload(date, date, timestamptz) TO authenticated;


-- Selected order task links use the same current-task predicate as workload.
CREATE OR REPLACE FUNCTION public.dashboard_order_current_tasks(p_order_id uuid)
RETURNS TABLE(task_id uuid, bike_display_id text, bike_title text, status text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() IS NULL OR public.get_user_role() NOT IN (
    'admin'::public.user_role, 'manager'::public.user_role, 'mechanic'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Dashboard task links are restricted to staff' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'An order ID is required' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT t.id, COALESCE(NULLIF(t.bike_display_id, ''), NULLIF(ai.bike_display_id, ''), t.booqable_stock_item_id),
           COALESCE(NULLIF(t.bike_title, ''), NULLIF(ai.bike_title, '')), t.status::text
    FROM public.bike_tasks t
    JOIN public.booqable_assignment_instances ai
      ON ai.id = t.assignment_instance_id AND ai.order_id = t.order_id
    WHERE t.order_id = p_order_id AND ai.closed_at IS NULL
      AND t.task_kind = 'rental_turnaround'
      AND t.status <> 'cancelled'::public.bike_task_status
    ORDER BY t.bike_display_id NULLS LAST, t.id;
END;
$$;
REVOKE ALL ON FUNCTION public.dashboard_order_current_tasks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_order_current_tasks(uuid) TO authenticated;
