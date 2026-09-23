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
          WHEN NULLIF(btrim(o.delivery_address), '') IS NOT NULL THEN 'address'
          WHEN NULLIF(btrim(o.maps_link_order), '') IS NOT NULL THEN 'maps'
          ELSE 'missing'
        END AS delivery_kind,
        CASE WHEN o.fulfillment_type = 'delivery'::public.fulfillment_type THEN
          COALESCE(
            NULLIF(btrim(o.delivery_address), ''),
            NULLIF(btrim(o.maps_link_order), '')
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
        COALESCE(sum(t.count) FILTER (WHERE t.status = ANY (ARRAY[
          'to_prepare'::public.bike_task_status,
          'being_prepared'::public.bike_task_status,
          'needs_recheck'::public.bike_task_status
        ])), 0)::integer AS preparation_task_count,
        COALESCE(jsonb_object_agg(t.status::text, t.count), '{}'::jsonb) AS lifecycle_counts
      FROM (
        SELECT t.order_id, t.status, count(*)::integer AS count
        FROM public.bike_tasks t
        JOIN public.booqable_assignment_instances ai
          ON ai.id = t.assignment_instance_id
         AND ai.order_id = t.order_id
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
        COALESCE(t.lifecycle_counts, '{}'::jsonb) AS lifecycle_counts
      FROM eligible_orders o
      LEFT JOIN current_tasks t ON t.order_id = o.id
      WHERE o.starts_at >= v_from AND o.starts_at < v_to_exclusive

      UNION ALL

      SELECT
        'incoming'::text AS direction,
        o.stops_at AS scheduled_at,
        (o.stops_at AT TIME ZONE 'Europe/Madrid')::date AS local_date,
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
        COALESCE(t.lifecycle_counts, '{}'::jsonb) AS lifecycle_counts
      FROM eligible_orders o
      LEFT JOIN current_tasks t ON t.order_id = o.id
      WHERE o.stops_at >= v_from AND o.stops_at < v_to_exclusive
    ),
    day_groups AS (
      SELECT
        r.direction,
        r.local_date,
        jsonb_agg(
          jsonb_build_object(
            'order_id', r.order_id,
            'scheduled_at', r.scheduled_at,
            'order_number', r.order_number,
            'customer_name', r.customer_name,
            'order_status', r.order_status,
            'fulfillment_type', r.fulfillment_type,
            'delivery_kind', r.delivery_kind,
            'delivery_value', r.delivery_value,
            'task_count', r.task_count,
            'ready_task_count', r.ready_task_count,
            'preparation_task_count', r.preparation_task_count,
            'lifecycle_counts', r.lifecycle_counts
          )
          ORDER BY r.scheduled_at, r.order_number NULLS LAST, r.order_id
        ) AS rows
      FROM directional_rows r
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
      'outgoing', (SELECT payload FROM directional_payload WHERE direction = 'outgoing'),
      'incoming', (SELECT payload FROM directional_payload WHERE direction = 'incoming')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_workload(date, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_workload(date, date, timestamptz) TO authenticated;
