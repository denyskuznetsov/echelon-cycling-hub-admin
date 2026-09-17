BEGIN;

SELECT no_plan();

CREATE OR REPLACE FUNCTION pg_temp.become(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.create_staff(
  p_id uuid,
  p_email text,
  p_first text,
  p_last text,
  p_role public.user_role
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    'x',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', p_first, 'last_name', p_last, 'role', p_role::text),
    now(),
    now(),
    false,
    false
  );
  UPDATE public.profiles
  SET first_name = p_first,
      last_name = p_last,
      role = p_role
  WHERE id = p_id;
  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.line(
  p_id text,
  p_title text,
  p_qty integer,
  p_parent text DEFAULT NULL,
  p_position integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'booqableLineId', p_id,
    'booqableItemId', 'item-' || p_id,
    'parentBooqableLineId', p_parent,
    'title', p_title,
    'quantity', p_qty,
    'lineType', 'charge',
    'chargeLabel', NULL,
    'extraInformation', NULL,
    'priceEachInCents', 0,
    'priceInCents', 0,
    'position', p_position,
    'relevant', true,
    'createdAt', '2026-08-01T09:00:00Z',
    'updatedAt', '2026-08-01T09:00:00Z'
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.assignment(
  p_stock text,
  p_sip text,
  p_tags jsonb,
  p_display text DEFAULT 'RF-1',
  p_title text DEFAULT 'Road Bike'
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'stockItemId', p_stock,
    'sipId', p_sip,
    'displayId', p_display,
    'title', p_title,
    'workshopTags', p_tags
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.partner_assignment(
  p_line text,
  p_n integer,
  p_title text DEFAULT 'Partner Canyon'
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'stockItemId', 'partner:' || p_line || ':' || p_n,
    'sipId', 'partner-sip:' || p_line || ':' || p_n,
    'booqableLineId', p_line,
    'displayId', 'Partner Bike',
    'title', p_title,
    'workshopTags', '["workshop-partner-bike"]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.snap(
  p_order_id text,
  p_status text,
  p_starts_at text,
  p_assignments jsonb,
  p_lines jsonb,
  p_number integer DEFAULT 344
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'fetchedAt', '2026-08-21T14:00:00.000Z',
    'sourceStatus', p_status,
    'order', jsonb_build_object(
      'booqableOrderId', p_order_id,
      'orderNumber', p_number,
      'status', p_status,
      'startsAt', p_starts_at,
      'stopsAt', '2026-12-12T17:00:00Z',
      'createdAt', '2026-08-01T09:00:00Z',
      'updatedAt', '2026-08-21T13:25:00Z',
      'fulfillmentType', 'pickup',
      'deliveryAddress', NULL,
      'billingAddress', NULL,
      'mapsLinkOrder', 'https://maps.example.test/' || p_order_id,
      'amountInCents', 1000,
      'discountType', NULL,
      'discountPercentage', NULL,
      'couponDiscountInCents', NULL,
      'couponCodeValue', NULL,
      'partnerPromo', NULL,
      'paymentStatus', 'paid',
      'depositInCents', 0,
      'taxInCents', 0,
      'grandTotalWithTaxInCents', 1000,
      'toBePaidInCents', 0,
      'itemCount', jsonb_array_length(p_lines)
    ),
    'customer', jsonb_build_object(
      'booqableCustomerId', 'cust-' || p_order_id,
      'name', 'Fixture Rider',
      'email', 'rider@example.test',
      'phone', '+34000000000',
      'birthday', '1990-05-17',
      'createdAt', '2026-01-01T00:00:00Z',
      'updatedAt', '2026-08-01T00:00:00Z'
    ),
    'coupon', NULL,
    'lines', p_lines,
    'assignments', p_assignments
  );
$$;

CREATE TEMP TABLE apply_leases (
  order_id text PRIMARY KEY,
  token uuid NOT NULL,
  fence bigint NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.ensure_lease(p_order_id text)
RETURNS apply_leases
LANGUAGE plpgsql
AS $$
DECLARE
  v_row apply_leases;
  v_lease jsonb;
BEGIN
  SELECT * INTO v_row FROM apply_leases WHERE order_id = p_order_id;
  IF v_row.token IS NOT NULL THEN
    RETURN v_row;
  END IF;
  v_lease := public.booqable_acquire_order_lease(
    p_order_id, now() + interval '1 hour', 'pg-test'
  );
  IF COALESCE((v_lease->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'lease failed: %', v_lease;
  END IF;
  INSERT INTO apply_leases (order_id, token, fence)
  VALUES (
    p_order_id,
    (v_lease->>'token')::uuid,
    (v_lease->>'fence')::bigint
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.apply_snap(p_order_id text, p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease apply_leases;
BEGIN
  v_lease := pg_temp.ensure_lease(p_order_id);
  RETURN public.booqable_apply_source_snapshot_v1(
    p_order_id, v_lease.token, v_lease.fence, p_snapshot
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.road_snap(
  p_order_id text,
  p_stock text DEFAULT 'stock-a',
  p_sip text DEFAULT 'sip-a',
  p_starts text DEFAULT '2026-12-10T10:00:00Z',
  p_extra_qty integer DEFAULT 1,
  p_status text DEFAULT 'reserved'
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT pg_temp.snap(
    p_order_id,
    p_status,
    p_starts,
    jsonb_build_array(
      pg_temp.assignment(p_stock, p_sip, '["workshop-road-bike"]'::jsonb)
    ),
    jsonb_build_array(
      pg_temp.line(p_order_id || '-bike', 'Road Bike', 1, NULL, 1),
      pg_temp.line(p_order_id || '-extra', 'Helmet', p_extra_qty, NULL, 2)
    )
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.fulfillment_snap(
  p_order_id text,
  p_status text,
  p_statuses jsonb,
  p_status_counts jsonb,
  p_stock text DEFAULT 'stock-a',
  p_sip text DEFAULT 'sip-a'
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_set(
    jsonb_set(
      pg_temp.road_snap(
        p_order_id,
        p_stock,
        p_sip,
        '2026-12-10T10:00:00Z',
        1,
        p_status
      ),
      '{order,statuses}',
      p_statuses,
      true
    ),
    '{order,statusCounts}',
    p_status_counts,
    true
  );
$$;

-- Identified road
SELECT is(
  (pg_temp.apply_snap('bq-road', pg_temp.road_snap('bq-road'))->>'ok')::boolean,
  true,
  'identified road apply succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.booqable_assignment_instances i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.booqable_order_id = 'bq-road' AND i.closed_at IS NULL
  ),
  1,
  'identified road opens one instance'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'to_prepare',
  'identified road task is to_prepare'
);

UPDATE public.orders
SET workshop_fulfillment_state = 'unknown',
    workshop_fulfillment_evidence_observed = false
WHERE booqable_order_id = 'bq-road';

SELECT is(
  private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-road')
  ),
  NULL,
  'pre-migration task with no observed aggregate evidence has no unknown notice'
);

SELECT ok(
  (pg_temp.apply_snap('bq-road', pg_temp.road_snap('bq-road'))->>'ok')::boolean,
  'first post-migration source apply records evidence observation'
);

SELECT ok(
  (SELECT workshop_fulfillment_evidence_observed FROM public.orders
   WHERE booqable_order_id = 'bq-road'),
  'successful source apply marks fulfillment evidence observed'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-null-evidence',
    jsonb_set(
      jsonb_set(
        pg_temp.road_snap('bq-null-evidence'),
        '{order,statuses}', 'null'::jsonb, true
      ),
      '{order,statusCounts}', 'null'::jsonb, true
    )
  )->>'fulfillmentState'),
  'reserved',
  'explicit null aggregates preserve a non-contradictory reserved state'
);

SELECT is(
  (SELECT booqable_statuses FROM public.orders
   WHERE booqable_order_id = 'bq-null-evidence'),
  NULL,
  'explicit JSON null aggregate evidence persists as SQL null'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
      AND i.stage = 'preparation'
  ),
  20,
  'identified road copies ROAD items'
);

SELECT isnt(
  (SELECT source_fingerprint FROM public.orders WHERE booqable_order_id = 'bq-road'),
  NULL,
  'identified road sets source_fingerprint'
);

SELECT isnt(
  (SELECT addon_fingerprint FROM public.orders WHERE booqable_order_id = 'bq-road'),
  NULL,
  'identified road sets addon_fingerprint'
);

SELECT is(
  (
    SELECT i.booqable_stock_item_planning_id
    FROM public.booqable_assignment_instances i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'sip-a',
  'identified road stores SIP id on the instance'
);

SELECT is(
  (
    SELECT e.source
    FROM public.bike_task_events e
    JOIN public.bike_tasks t ON t.id = e.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
    LIMIT 1
  ),
  'source_apply',
  'identified road events use source_apply'
);

SELECT is(
  (
    SELECT c.booqable_customer_id
    FROM public.customers c
    JOIN public.orders o ON o.customer_id = c.id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'cust-bq-road',
  'identified road upserts the snapshot customer'
);

SELECT is(
  (
    SELECT o.customer_id IS NOT NULL
    FROM public.orders o
    WHERE o.booqable_order_id = 'bq-road'
  ),
  true,
  'identified road points orders.customer_id at that customer'
);

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-road',
      jsonb_set(
        jsonb_set(pg_temp.road_snap('bq-road'), '{customer,name}', '"Renamed Rider"'),
        '{customer,email}',
        '"renamed@example.test"'
      )
    )->>'ok'
  )::boolean,
  'customer name/email update apply succeeds'
);

SELECT is(
  (
    SELECT c.name
    FROM public.customers c
    JOIN public.orders o ON o.customer_id = c.id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'Renamed Rider',
  'second apply updates customer name'
);

SELECT is(
  (
    SELECT c.email
    FROM public.customers c
    JOIN public.orders o ON o.customer_id = c.id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'renamed@example.test',
  'second apply updates customer email'
);

INSERT INTO public.customer_sync (
  customer_id,
  google_id,
  google_status,
  google_error,
  holded_id,
  holded_status,
  holded_error,
  mailchimp_id,
  mailchimp_status,
  mailchimp_error,
  synced_at
)
SELECT
  c.id,
  'people/c-apply',
  'green',
  NULL,
  'holded-apply',
  'green',
  NULL,
  'mc-apply',
  'red',
  'Mailchimp: check the audience.',
  now()
FROM public.customers c
WHERE c.booqable_customer_id = 'cust-bq-road';

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-road',
      jsonb_set(
        jsonb_set(pg_temp.road_snap('bq-road'), '{customer,name}', '"Renamed Rider"'),
        '{customer,email}',
        '"renamed@example.test"'
      )
    )->>'ok'
  )::boolean,
  'apply after customer sync is set succeeds'
);

SELECT is(
  (
    SELECT s.google_id
    FROM public.customer_sync s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE c.booqable_customer_id = 'cust-bq-road'
  ),
  'people/c-apply',
  'order apply does not clear landing dest ids'
);

SELECT is(
  (
    SELECT s.google_status
    FROM public.customer_sync s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE c.booqable_customer_id = 'cust-bq-road'
  ),
  'green',
  'order apply does not clear landing status'
);

SELECT is(
  (
    SELECT s.holded_id
    FROM public.customer_sync s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE c.booqable_customer_id = 'cust-bq-road'
  ),
  'holded-apply',
  'order apply does not clear Holded landing dest ids'
);

SELECT is(
  (
    SELECT s.holded_status
    FROM public.customer_sync s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE c.booqable_customer_id = 'cust-bq-road'
  ),
  'green',
  'order apply does not clear Holded landing status'
);

SELECT is(
  (
    SELECT s.mailchimp_id
    FROM public.customer_sync s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE c.booqable_customer_id = 'cust-bq-road'
  ),
  'mc-apply',
  'order apply does not clear Mailchimp landing dest ids'
);

SELECT is(
  (
    SELECT s.mailchimp_status
    FROM public.customer_sync s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE c.booqable_customer_id = 'cust-bq-road'
  ),
  'red',
  'order apply does not clear Mailchimp landing status'
);

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-road',
      jsonb_set(pg_temp.road_snap('bq-road'), '{customer}', 'null'::jsonb)
    )->>'ok'
  )::boolean,
  'apply without a customer object succeeds'
);

SELECT is(
  (
    SELECT c.booqable_customer_id
    FROM public.customers c
    JOIN public.orders o ON o.customer_id = c.id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'cust-bq-road',
  'missing customer object does not wipe orders.customer_id'
);

-- Mixed identified + unidentified
SELECT is(
  (
    pg_temp.apply_snap(
      'bq-mixed',
      pg_temp.snap(
        'bq-mixed',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-mixed', 'sip-mixed', '["workshop-road-bike"]'::jsonb)
        ),
        jsonb_build_array(
          pg_temp.line('mixed-bike', 'Road', 1, NULL, 1),
          pg_temp.line('mixed-unidentified', 'Unidentified', 1, NULL, 2)
        )
      )
    )->>'created'
  )::integer,
  1,
  'mixed order creates a task only for the identified bike'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-mixed'
  ),
  1,
  'mixed order has exactly one task'
);

-- Replay
CREATE TEMP TABLE road_ids AS
SELECT
  i.id AS instance_id,
  t.id AS task_id,
  t.version,
  o.source_fingerprint,
  o.addon_fingerprint
FROM public.orders o
JOIN public.booqable_assignment_instances i ON i.order_id = o.id
JOIN public.bike_tasks t ON t.assignment_instance_id = i.id
WHERE o.booqable_order_id = 'bq-road';

SELECT is(
  (pg_temp.apply_snap('bq-road', pg_temp.road_snap('bq-road'))->>'ok')::boolean,
  true,
  'replay apply succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  1,
  'replay does not create another task'
);

SELECT is(
  (
    SELECT t.id
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  (SELECT task_id FROM road_ids),
  'replay keeps the same task id'
);

SELECT is(
  (
    SELECT t.version
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  (SELECT version FROM road_ids),
  'replay does not bump version'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_events e
    JOIN public.bike_tasks t ON t.id = e.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  1,
  'replay inserts no new event rows'
);

-- Remove {A} then empty
SELECT is(
  (
    pg_temp.apply_snap(
      'bq-road',
      pg_temp.snap(
        'bq-road',
        'reserved',
        '2026-12-10T10:00:00Z',
        '[]'::jsonb,
        jsonb_build_array(pg_temp.line('bq-road-bike', 'Road Bike', 1, NULL, 1))
      )
    )->>'cancelled'
  )::integer,
  1,
  'remove closes the identified assignment'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  'cancelled',
  'remove cancels the task'
);

SELECT is(
  (
    SELECT i.closed_at IS NOT NULL
    FROM public.booqable_assignment_instances i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.booqable_order_id = 'bq-road'
      AND i.booqable_stock_item_id = 'stock-a'
  ),
  true,
  'remove closes the instance'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_events e
    JOIN public.bike_tasks t ON t.id = e.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ) >= 2,
  true,
  'remove keeps task history'
);

-- Re-add with a new SIP
SELECT is(
  (
    pg_temp.apply_snap(
      'bq-road',
      pg_temp.road_snap('bq-road', 'stock-a', 'sip-a-readd')
    )->>'created'
  )::integer,
  1,
  're-add after close creates a new instance'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.booqable_assignment_instances i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.booqable_order_id = 'bq-road'
  ),
  2,
  're-add keeps the closed instance'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.booqable_assignment_instances i ON i.id = t.assignment_instance_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-road'
      AND i.closed_at IS NULL
  ),
  'to_prepare',
  're-add mints a fresh to_prepare task'
);

-- Replace {A} then {B}
SELECT ok(
  (pg_temp.apply_snap('bq-replace', pg_temp.road_snap('bq-replace', 'stock-a', 'sip-a'))->>'ok')::boolean,
  'replace setup for A succeeds'
);

SELECT is(
  (
    pg_temp.apply_snap(
      'bq-replace',
      pg_temp.road_snap('bq-replace', 'stock-b', 'sip-b', '2026-12-10T10:00:00Z', 1)
    )->>'created'
  )::integer,
  1,
  'replace creates B'
);

SELECT is(
  (
    SELECT count(*) FILTER (WHERE t.status = 'cancelled')::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-replace'
  ),
  1,
  'replace cancels A'
);

SELECT is(
  (
    SELECT t.booqable_stock_item_id
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-replace'
      AND t.status = 'to_prepare'
  ),
  'stock-b',
  'replace B is a new task'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-replace'
      AND t.status = 'cancelled'
  ) IS DISTINCT FROM (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-replace'
      AND t.status = 'to_prepare'
  ),
  false,
  'replace does not transfer item rows to B (B has its own copy)'
);

SELECT is(
  (
    SELECT count(DISTINCT t.id)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-replace'
  ),
  2,
  'replace keeps A history items and creates B items separately'
);

-- Date-only
SELECT ok(
  (pg_temp.apply_snap('bq-date', pg_temp.road_snap('bq-date'))->>'ok')::boolean,
  'date-only setup succeeds'
);

CREATE TEMP TABLE date_before AS
SELECT t.id AS task_id, t.version, count(i.id)::integer AS items
FROM public.bike_tasks t
JOIN public.orders o ON o.id = t.order_id
LEFT JOIN public.bike_task_items i ON i.task_id = t.id
WHERE o.booqable_order_id = 'bq-date'
GROUP BY t.id, t.version;

SELECT is(
  (
    pg_temp.apply_snap(
      'bq-date',
      pg_temp.road_snap('bq-date', 'stock-a', 'sip-a', '2026-12-09T10:00:00Z')
    )->>'retained'
  )::integer,
  1,
  'date-only retains the assignment'
);

SELECT is(
  (
    SELECT t.starts_at
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-date'
  ),
  timestamptz '2026-12-09 10:00:00+00',
  'date-only copies queue starts_at'
);

SELECT is(
  (
    SELECT t.version
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-date'
  ),
  (SELECT version FROM date_before),
  'date-only does not bump version'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-date'
  ),
  (SELECT items FROM date_before),
  'date-only keeps checklist work'
);

-- to_prepare checklist replace
SELECT ok(
  (pg_temp.apply_snap('bq-prep-replace', pg_temp.road_snap('bq-prep-replace'))->>'ok')::boolean,
  'to_prepare replace setup succeeds'
);

SELECT is(
  (
    SELECT t.version
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
  ),
  1,
  'to_prepare replace starts at version 1'
);

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-prep-replace',
      pg_temp.snap(
        'bq-prep-replace',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-a', 'sip-a', '["workshop-e-mtb-bike"]'::jsonb)
        ),
        jsonb_build_array(
          pg_temp.line('bq-prep-replace-bike', 'Road Bike', 1, NULL, 1),
          pg_temp.line('bq-prep-replace-extra', 'Helmet', 1, NULL, 2)
        )
      )
    )->>'ok'
  )::boolean,
  'to_prepare e-mtb re-apply succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
      AND i.stage = 'preparation'
  ),
  0,
  'to_prepare tag change removes prep items'
);

SELECT is(
  (
    SELECT t.version
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
  ),
  2,
  'to_prepare tag change bumps version'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
  ),
  true,
  'to_prepare tag change sets warning'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_events e
    JOIN public.bike_tasks t ON t.id = e.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
      AND e.event_kind = 'checklist_changed'
      AND e.source = 'source_apply'
  ),
  1,
  'to_prepare tag change writes checklist_changed from source_apply'
);

SELECT ok(
  (pg_temp.apply_snap('bq-prep-replace', pg_temp.road_snap('bq-prep-replace'))->>'ok')::boolean,
  'to_prepare road restore succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
      AND i.stage = 'preparation'
  ),
  20,
  'to_prepare road restore recopies ROAD items'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-replace'
  ),
  false,
  'to_prepare road restore clears warning'
);

-- to_prepare road → gravel replaces onto the gravel catalog
SELECT ok(
  (pg_temp.apply_snap('bq-prep-gravel', pg_temp.road_snap('bq-prep-gravel'))->>'ok')::boolean,
  'to_prepare gravel replace setup succeeds'
);

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-prep-gravel',
      pg_temp.snap(
        'bq-prep-gravel',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-a', 'sip-a', '["workshop-gravel-bike"]'::jsonb)
        ),
        jsonb_build_array(
          pg_temp.line('bq-prep-gravel-bike', 'Road Bike', 1, NULL, 1),
          pg_temp.line('bq-prep-gravel-extra', 'Helmet', 1, NULL, 2)
        )
      )
    )->>'ok'
  )::boolean,
  'to_prepare gravel re-apply succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-gravel'
      AND i.stage = 'preparation'
  ),
  20,
  'to_prepare gravel replace copies 20 items'
);

SELECT is(
  (
    SELECT i.label
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-gravel'
      AND i.stage = 'preparation'
    ORDER BY i.sort_order DESC
    LIMIT 1
  ),
  'Attach a haribo pouch to the bike',
  'to_prepare gravel replace last item is Haribo'
);

SELECT is(
  (
    SELECT d.definition_key
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    JOIN public.checklist_definitions d ON d.id = t.selected_definition_id
    WHERE o.booqable_order_id = 'bq-prep-gravel'
  ),
  'gravel_bike_preparation',
  'to_prepare gravel replace selects gravel_bike_preparation'
);

SELECT is(
  (
    SELECT d.version
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    JOIN public.checklist_definitions d ON d.id = t.selected_definition_id
    WHERE o.booqable_order_id = 'bq-prep-gravel'
  ),
  1,
  'to_prepare gravel replace selects gravel v1'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-prep-gravel'
  ),
  false,
  'to_prepare gravel replace clears warning'
);

-- started/stopped must not cancel
SELECT ok(
  (pg_temp.apply_snap('bq-live-status', pg_temp.road_snap('bq-live-status'))->>'ok')::boolean,
  'started/stopped setup succeeds'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-live-status',
    pg_temp.road_snap('bq-live-status', 'stock-a', 'sip-a', '2026-12-10T10:00:00Z', 1, 'started')
  )->>'ok')::boolean,
  true,
  'source started apply succeeds'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-live-status'
  ),
  'to_prepare',
  'source started does not cancel the task'
);

SELECT is(
  (
    SELECT i.closed_at IS NULL
    FROM public.booqable_assignment_instances i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.booqable_order_id = 'bq-live-status'
  ),
  true,
  'source started keeps the instance open'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-live-status',
    pg_temp.road_snap('bq-live-status', 'stock-a', 'sip-a', '2026-12-10T10:00:00Z', 1, 'stopped')
  )->>'ok')::boolean,
  true,
  'source stopped apply succeeds'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-live-status'
  ),
  'to_prepare',
  'source stopped does not cancel the task'
);

SELECT is(
  (
    SELECT i.closed_at IS NULL
    FROM public.booqable_assignment_instances i
    JOIN public.orders o ON o.id = i.order_id
    WHERE o.booqable_order_id = 'bq-live-status'
  ),
  true,
  'source stopped keeps the instance open'
);

-- Source canceled with stock still present
SELECT ok(
  (pg_temp.apply_snap('bq-cancel', pg_temp.road_snap('bq-cancel'))->>'ok')::boolean,
  'canceled setup succeeds'
);

SELECT is(
  (
    pg_temp.apply_snap(
      'bq-cancel',
      pg_temp.road_snap('bq-cancel', 'stock-a', 'sip-a', '2026-12-10T10:00:00Z', 1, 'canceled')
    )->>'cancelled'
  )::integer,
  1,
  'source canceled cancels the nonterminal task'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-cancel'
      AND t.status = 'to_prepare'
  ),
  0,
  'source canceled does not mint a new task'
);

SELECT is(
  (
    SELECT o.status::text
    FROM public.orders o
    WHERE o.booqable_order_id = 'bq-cancel'
  ),
  'canceled',
  'source canceled upserts order status'
);

-- No tag / unknown tag
SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-notag',
      pg_temp.snap(
        'bq-notag',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(pg_temp.assignment('stock-nt', 'sip-nt', '[]'::jsonb)),
        jsonb_build_array(pg_temp.line('notag-bike', 'Bike', 1))
      )
    )->>'ok'
  )::boolean,
  'missing tag still creates a task'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-notag'
  ),
  true,
  'missing tag sets configuration warning'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-notag'
  ),
  0,
  'missing tag copies no prep items'
);

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-gravel',
      pg_temp.snap(
        'bq-gravel',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-g', 'sip-g', '["workshop-gravel-bike"]'::jsonb, 'GF/L-1', 'Gravel')
        ),
        jsonb_build_array(pg_temp.line('gravel-bike', 'Gravel', 1))
      )
    )->>'ok'
  )::boolean,
  'gravel tag still creates a task'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-gravel'
  ),
  false,
  'gravel tag has no configuration warning'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-gravel'
      AND i.stage = 'preparation'
  ),
  20,
  'gravel tag copies ROAD snapshot items'
);

SELECT pg_temp.create_staff(
  '11111111-1111-4111-8111-111111111111',
  'mech-apply@example.test',
  'Ada',
  'Mechanic',
  'mechanic'
);

SELECT pg_temp.become('11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;

SELECT is(
  (
    public.workshop_start_preparation(
      (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id WHERE o.booqable_order_id = 'bq-gravel'),
      1
    )->>'status'
  ),
  'being_prepared',
  'gravel tag start preparation → being_prepared'
);

RESET ROLE;

-- Tag drift after prep starts
SELECT ok(
  (pg_temp.apply_snap('bq-drift', pg_temp.road_snap('bq-drift'))->>'ok')::boolean,
  'tag drift setup succeeds'
);

SELECT pg_temp.become('11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;

SELECT is(
  (
    public.workshop_start_preparation(
      (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id WHERE o.booqable_order_id = 'bq-drift'),
      1
    )->>'ok'
  )::boolean,
  true,
  'tag drift can start preparation on road'
);

RESET ROLE;

CREATE TEMP TABLE drift_before AS
SELECT
  t.selected_definition_id,
  ARRAY(
    SELECT i.id
    FROM public.bike_task_items i
    WHERE i.task_id = t.id
      AND i.stage = 'preparation'
    ORDER BY i.id
  ) AS item_ids
FROM public.bike_tasks t
JOIN public.orders o ON o.id = t.order_id
WHERE o.booqable_order_id = 'bq-drift';

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-drift',
      pg_temp.snap(
        'bq-drift',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-a', 'sip-a', '["workshop-gravel-bike"]'::jsonb)
        ),
        jsonb_build_array(
          pg_temp.line('bq-drift-bike', 'Road Bike', 1, NULL, 1),
          pg_temp.line('bq-drift-extra', 'Helmet', 1, NULL, 2)
        )
      )
    )->>'ok'
  )::boolean,
  'tag drift apply succeeds'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-drift'
  ),
  'being_prepared',
  'tag drift does not reopen status'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-drift'
  ),
  true,
  'tag drift sets warning'
);

SELECT is(
  (
    SELECT t.selected_definition_id
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-drift'
  ),
  (SELECT selected_definition_id FROM drift_before),
  'tag drift keeps selected_definition_id'
);

SELECT isnt(
  (SELECT selected_definition_id FROM drift_before),
  (
    SELECT d.id
    FROM public.checklist_definitions d
    WHERE d.definition_key = 'gravel_bike_preparation' AND d.version = 1
  ),
  'tag drift selected_definition_id is not gravel v1'
);

SELECT is(
  ARRAY(
    SELECT i.id
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-drift'
      AND i.stage = 'preparation'
    ORDER BY i.id
  ),
  (SELECT item_ids FROM drift_before),
  'tag drift freezes checklist item ids'
);

-- After ready_for_pickup extras 1→0
SELECT ok(
  (pg_temp.apply_snap('bq-ready', pg_temp.road_snap('bq-ready', 'stock-a', 'sip-a', '2026-12-10T10:00:00Z', 1))->>'ok')::boolean,
  'ready extras setup succeeds'
);

UPDATE public.bike_tasks t
SET status = 'ready_for_pickup'
FROM public.orders o
WHERE o.id = t.order_id
  AND o.booqable_order_id = 'bq-ready';

CREATE TEMP TABLE ready_fp AS
SELECT addon_fingerprint
FROM public.orders
WHERE booqable_order_id = 'bq-ready';

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-ready',
      pg_temp.road_snap('bq-ready', 'stock-a', 'sip-a', '2026-12-10T10:00:00Z', 0)
    )->>'ok'
  )::boolean,
  'ready extras quantity 0 apply succeeds'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-ready'
  ),
  'ready_for_pickup',
  'after ready extras do not reopen status'
);

SELECT isnt(
  (SELECT addon_fingerprint FROM public.orders WHERE booqable_order_id = 'bq-ready'),
  (SELECT addon_fingerprint FROM ready_fp),
  'after ready extras update addon_fingerprint'
);

SELECT is(
  (
    SELECT oi.quantity
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.booqable_order_id = 'bq-ready'
      AND oi.booqable_line_id = 'bq-ready-extra'
  ),
  0,
  'quantity 0 extras stay as rows'
);

-- Automatic full-order pickup advances only eligible retained siblings.
SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-auto-pickup',
      pg_temp.snap(
        'bq-auto-pickup',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-ready', 'sip-ready', '["workshop-road-bike"]'::jsonb),
          pg_temp.assignment('stock-blocked', 'sip-blocked', '["workshop-road-bike"]'::jsonb)
        ),
        jsonb_build_array(
          pg_temp.line('auto-bike-1', 'Ready bike', 1, NULL, 1),
          pg_temp.line('auto-bike-2', 'Blocked bike', 1, NULL, 2)
        )
      )
    )->>'ok'
  )::boolean,
  'automatic pickup setup succeeds'
);

UPDATE public.bike_tasks t
SET status = CASE
      WHEN t.booqable_stock_item_id = 'stock-ready'
        THEN 'ready_for_pickup'::public.bike_task_status
      ELSE 'needs_recheck'::public.bike_task_status
    END,
    version = 10
FROM public.orders o
WHERE o.id = t.order_id
  AND o.booqable_order_id = 'bq-auto-pickup';

UPDATE public.bike_task_items i
SET m1_outcome = 'completed'::public.checklist_item_outcome
FROM public.bike_tasks t
JOIN public.orders o ON o.id = t.order_id
WHERE i.task_id = t.id
  AND o.booqable_order_id = 'bq-auto-pickup'
  AND t.booqable_stock_item_id = 'stock-blocked'
  AND i.item_key = 'ROAD-01';

INSERT INTO public.bike_task_attestations (
  task_id, stage, user_id, first_name, last_name
)
SELECT
  t.id, 'm1', '00000000-0000-4000-8000-000000000211', 'Source', 'Fixture'
FROM public.bike_tasks t
JOIN public.orders o ON o.id = t.order_id
WHERE o.booqable_order_id = 'bq-auto-pickup'
  AND t.booqable_stock_item_id = 'stock-blocked';

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-auto-pickup',
      jsonb_set(
        jsonb_set(
          pg_temp.snap(
            'bq-auto-pickup',
            'started',
            '2026-12-10T10:00:00Z',
            jsonb_build_array(
              pg_temp.assignment('stock-ready', 'sip-ready', '["workshop-road-bike"]'::jsonb),
              pg_temp.assignment('stock-blocked', 'sip-blocked', '["workshop-road-bike"]'::jsonb)
            ),
            jsonb_build_array(
              pg_temp.line('auto-bike-1', 'Ready bike', 1, NULL, 1),
              pg_temp.line('auto-bike-2', 'Blocked bike', 1, NULL, 2)
            )
          ),
          '{order,statuses}', '["started"]'::jsonb, true
        ),
        '{order,statusCounts}',
        '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb,
        true
      )
    )->>'ok'
  )::boolean,
  'complete pickup apply succeeds'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup' AND t.booqable_stock_item_id = 'stock-ready'),
  'in_rental',
  'complete pickup advances the ready sibling'
);

SELECT is(
  (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup' AND t.booqable_stock_item_id = 'stock-ready'),
  11,
  'automatic pickup increments version once'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup' AND t.booqable_stock_item_id = 'stock-blocked'),
  'needs_recheck',
  'complete pickup does not advance an unfinished sibling'
);

SELECT is(
  (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup' AND t.booqable_stock_item_id = 'stock-blocked'),
  10,
  'blocked pickup does not bump the unfinished task version'
);

SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-auto-pickup'
       AND t.booqable_stock_item_id = 'stock-blocked')
  )->>'kind'),
  'not_ready',
  'full pickup ahead of unfinished preparation exposes not-ready notice'
);

SELECT is(
  (SELECT i.m1_outcome::text FROM public.bike_task_items i
   JOIN public.bike_tasks t ON t.id = i.task_id JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup'
     AND t.booqable_stock_item_id = 'stock-blocked' AND i.item_key = 'ROAD-01'),
  'completed',
  'blocked pickup preserves checklist values'
);

SELECT is(
  (SELECT count(*)::integer FROM public.bike_task_attestations a
   JOIN public.bike_tasks t ON t.id = a.task_id JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup'
     AND t.booqable_stock_item_id = 'stock-blocked'),
  1,
  'blocked pickup preserves attestations'
);

SELECT is(
  (SELECT count(*)::integer FROM public.bike_task_events e
   JOIN public.bike_tasks t ON t.id = e.task_id JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup'
     AND t.booqable_stock_item_id = 'stock-ready'
     AND e.from_status = 'ready_for_pickup' AND e.to_status = 'in_rental'
     AND e.source = 'source_apply' AND e.actor_id IS NULL),
  1,
  'automatic pickup appends one source-attributed event'
);

-- A same-source replay is a no-op, but later readiness is reconsidered.
SELECT ok(
  (pg_temp.apply_snap(
    'bq-auto-pickup',
    jsonb_set(
      jsonb_set(
        pg_temp.snap(
          'bq-auto-pickup', 'started', '2026-12-10T10:00:00Z',
          jsonb_build_array(
            pg_temp.assignment('stock-ready', 'sip-ready', '["workshop-road-bike"]'::jsonb),
            pg_temp.assignment('stock-blocked', 'sip-blocked', '["workshop-road-bike"]'::jsonb)
          ),
          jsonb_build_array(
            pg_temp.line('auto-bike-1', 'Ready bike', 1, NULL, 1),
            pg_temp.line('auto-bike-2', 'Blocked bike', 1, NULL, 2)
          )
        ),
        '{order,statuses}', '["started"]'::jsonb, true
      ),
      '{order,statusCounts}',
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb,
      true
    )
  )->>'ok')::boolean,
  'complete pickup replay succeeds'
);

SELECT is(
  (SELECT count(*)::integer FROM public.bike_task_events e
   JOIN public.bike_tasks t ON t.id = e.task_id JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup'
     AND t.booqable_stock_item_id = 'stock-ready'
     AND e.from_status = 'ready_for_pickup' AND e.to_status = 'in_rental'),
  1,
  'complete pickup replay adds no transition event'
);

UPDATE public.bike_tasks t
SET status = 'ready_for_pickup', version = version + 1
FROM public.orders o
WHERE o.id = t.order_id
  AND o.booqable_order_id = 'bq-auto-pickup'
  AND t.booqable_stock_item_id = 'stock-blocked';

SELECT ok(
  (pg_temp.apply_snap(
    'bq-auto-pickup',
    jsonb_set(
      jsonb_set(
        pg_temp.snap(
          'bq-auto-pickup', 'started', '2026-12-10T10:00:00Z',
          jsonb_build_array(
            pg_temp.assignment('stock-ready', 'sip-ready', '["workshop-road-bike"]'::jsonb),
            pg_temp.assignment('stock-blocked', 'sip-blocked', '["workshop-road-bike"]'::jsonb)
          ),
          jsonb_build_array(
            pg_temp.line('auto-bike-1', 'Ready bike', 1, NULL, 1),
            pg_temp.line('auto-bike-2', 'Blocked bike', 1, NULL, 2)
          )
        ),
        '{order,statuses}', '["started"]'::jsonb, true
      ),
      '{order,statusCounts}',
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb,
      true
    )
  )->>'ok')::boolean,
  'unchanged complete pickup retries after local readiness'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-auto-pickup' AND t.booqable_stock_item_id = 'stock-blocked'),
  'in_rental',
  'later refresh advances a newly ready sibling'
);

-- Mixed/unknown fulfillment stays manual and exposes a persistent explanation.
SELECT ok(
  (pg_temp.apply_snap('bq-partial', pg_temp.road_snap('bq-partial'))->>'ok')::boolean,
  'partial setup succeeds'
);
UPDATE public.bike_tasks t SET status = 'ready_for_pickup', version = 7
FROM public.orders o WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-partial';

SELECT is(
  (pg_temp.apply_snap(
    'bq-partial',
    pg_temp.fulfillment_snap(
      'bq-partial', 'started', '["reserved","started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":1,"started":1,"stopped":0}'::jsonb
    )
  )->>'fulfillmentState'),
  'mixed',
  'partial pickup classifies as mixed'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-partial'),
  'ready_for_pickup',
  'partial pickup does not advance the task'
);

SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-partial')
  )->>'kind'),
  'mixed',
  'mixed state persists a manual-handling notice'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-partial',
    pg_temp.road_snap(
      'bq-partial', 'stock-a', 'sip-a', '2026-12-10T10:00:00Z', 1, 'started'
    )
  )->>'fulfillmentState'),
  'unknown',
  'missing aggregate pickup evidence classifies as unknown'
);

SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-partial')
  )->>'kind'),
  'unknown',
  'unknown pickup evidence persists an explanatory notice'
);

SELECT pg_temp.become('11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;
SELECT is(
  (public.workshop_task_detail(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-partial')
  )->'sourceNotice'->>'kind'),
  'unknown',
  'authorized task detail exposes the persisted source notice'
);
RESET ROLE;

SELECT pg_temp.become('11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;
SELECT is(
  (public.workshop_mark_picked_up(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-partial'),
    (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-partial')
  )->>'status'),
  'in_rental',
  'existing manual pickup RPC remains usable after a mixed/unknown no-op'
);
RESET ROLE;

SELECT is(
  (pg_temp.apply_snap(
    'bq-partial',
    pg_temp.fulfillment_snap(
      'bq-partial', 'started', '["started","stopped"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":1,"stopped":1}'::jsonb
    )
  )->>'fulfillmentState'),
  'mixed',
  'partial return classifies as mixed'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-partial'),
  'in_rental',
  'partial return does not advance the task'
);

-- Partner tasks use the same uniform whole-order rule.
SELECT ok(
  (pg_temp.apply_snap(
    'bq-partner-auto',
    pg_temp.snap(
      'bq-partner-auto', 'reserved', '2026-12-10T10:00:00Z',
      jsonb_build_array(pg_temp.partner_assignment('partner-line', 1)),
      jsonb_build_array(pg_temp.line('partner-line', 'Partner Bike', 1, NULL, 1))
    )
  )->>'ok')::boolean,
  'partner automatic pickup setup succeeds'
);
UPDATE public.bike_tasks t SET status = 'ready_for_pickup', version = 3
FROM public.orders o WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-partner-auto';
SELECT ok(
  (pg_temp.apply_snap(
    'bq-partner-auto',
    jsonb_set(
      jsonb_set(
        pg_temp.snap(
          'bq-partner-auto', 'started', '2026-12-10T10:00:00Z',
          jsonb_build_array(pg_temp.partner_assignment('partner-line', 1)),
          jsonb_build_array(pg_temp.line('partner-line', 'Partner Bike', 1, NULL, 1))
        ),
        '{order,statuses}', '["started"]'::jsonb, true
      ),
      '{order,statusCounts}',
      '{"draft":0,"new":0,"reserved":0,"started":1,"stopped":0}'::jsonb,
      true
    )
  )->>'ok')::boolean,
  'partner complete pickup apply succeeds'
);
SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-partner-auto'),
  'in_rental',
  'partner task advances under the same pickup guard'
);

-- Final stopped is authoritative, including differing non-returnable counts;
-- a sibling that missed pickup is not caught up through two transitions.
SELECT ok(
  (pg_temp.apply_snap(
    'bq-final-return',
    pg_temp.snap(
      'bq-final-return', 'reserved', '2026-12-10T10:00:00Z',
      jsonb_build_array(
        pg_temp.assignment('stock-rented', 'sip-rented', '["workshop-road-bike"]'::jsonb),
        pg_temp.assignment('stock-missed', 'sip-missed', '["workshop-road-bike"]'::jsonb)
      ),
      jsonb_build_array(
        pg_temp.line('return-bike-1', 'Rented bike', 1, NULL, 1),
        pg_temp.line('return-bike-2', 'Missed bike', 1, NULL, 2),
        pg_temp.line('return-sale', 'Bottle', 1, NULL, 3)
      )
    )
  )->>'ok')::boolean,
  'final return setup succeeds'
);
UPDATE public.bike_tasks t
SET status = CASE WHEN t.booqable_stock_item_id = 'stock-rented'
                  THEN 'in_rental'::public.bike_task_status
                  ELSE 'ready_for_pickup'::public.bike_task_status END,
    version = 8
FROM public.orders o
WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-final-return';

SELECT is(
  (pg_temp.apply_snap(
    'bq-final-return',
    jsonb_set(
      jsonb_set(
        pg_temp.snap(
          'bq-final-return', 'stopped', '2026-12-10T10:00:00Z',
          jsonb_build_array(
            pg_temp.assignment('stock-rented', 'sip-rented', '["workshop-road-bike"]'::jsonb),
            pg_temp.assignment('stock-missed', 'sip-missed', '["workshop-road-bike"]'::jsonb)
          ),
          jsonb_build_array(
            pg_temp.line('return-bike-1', 'Rented bike', 1, NULL, 1),
            pg_temp.line('return-bike-2', 'Missed bike', 1, NULL, 2),
            pg_temp.line('return-sale', 'Bottle', 1, NULL, 3)
          )
        ),
        '{order,statuses}', '["started","stopped"]'::jsonb, true
      ),
      '{order,statusCounts}',
      '{"draft":0,"new":0,"reserved":0,"started":1,"stopped":2}'::jsonb,
      true
    )
  )->>'fulfillmentState'),
  'final_return',
  'stopped remains authoritative despite a non-returnable started count'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-final-return' AND t.booqable_stock_item_id = 'stock-rented'),
  'returned',
  'final return advances only the in-rental task'
);

SELECT is(
  (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-final-return' AND t.booqable_stock_item_id = 'stock-rented'),
  9,
  'automatic final return increments version exactly once'
);

SELECT is(
  (SELECT count(*)::integer FROM public.bike_task_events e
   JOIN public.bike_tasks t ON t.id = e.task_id
   JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-final-return'
     AND t.booqable_stock_item_id = 'stock-rented'
     AND e.from_status = 'in_rental' AND e.to_status = 'returned'
     AND e.source = 'source_apply' AND e.actor_id IS NULL
     AND e.source_fingerprint = o.source_fingerprint),
  1,
  'automatic final return writes one actorless source event with fingerprint'
);

SELECT ok(
  (pg_temp.apply_snap(
    'bq-final-return',
    jsonb_set(
      jsonb_set(
        pg_temp.snap(
          'bq-final-return', 'stopped', '2026-12-10T10:00:00Z',
          jsonb_build_array(
            pg_temp.assignment('stock-rented', 'sip-rented', '["workshop-road-bike"]'::jsonb),
            pg_temp.assignment('stock-missed', 'sip-missed', '["workshop-road-bike"]'::jsonb)
          ),
          jsonb_build_array(
            pg_temp.line('return-bike-1', 'Rented bike', 1, NULL, 1),
            pg_temp.line('return-bike-2', 'Missed bike', 1, NULL, 2),
            pg_temp.line('return-sale', 'Bottle', 1, NULL, 3)
          )
        ),
        '{order,statuses}', '["started","stopped"]'::jsonb, true
      ),
      '{order,statusCounts}',
      '{"draft":0,"new":0,"reserved":0,"started":1,"stopped":2}'::jsonb,
      true
    )
  )->>'ok')::boolean,
  'final return replay succeeds'
);

SELECT is(
  (SELECT count(*)::integer FROM public.bike_task_events e
   JOIN public.bike_tasks t ON t.id = e.task_id
   JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-final-return'
     AND t.booqable_stock_item_id = 'stock-rented'
     AND e.from_status = 'in_rental' AND e.to_status = 'returned'
     AND e.source = 'source_apply'),
  1,
  'final return replay adds no duplicate transition event'
);

SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-final-return' AND t.booqable_stock_item_id = 'stock-missed'),
  'ready_for_pickup',
  'final return does not synthesize a missed pickup transition'
);

SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-final-return'
       AND t.booqable_stock_item_id = 'stock-missed')
  )->>'kind'),
  'missed_pickup',
  'missed pickup persists a manual-recovery notice'
);

-- New discoveries never inherit an already-started order's progress.
SELECT ok(
  (pg_temp.apply_snap(
    'bq-new-started',
    pg_temp.fulfillment_snap(
      'bq-new-started', 'started', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb,
      'stock-new', 'sip-new'
    )
  )->>'ok')::boolean,
  'new task on a started order applies'
);
SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-new-started'),
  'to_prepare',
  'newly discovered task does not skip preparation'
);

-- Replacement task lifecycles do not inherit the replaced task's reversal history.
SELECT ok(
  (pg_temp.apply_snap(
    'bq-lifecycle-replace',
    pg_temp.road_snap('bq-lifecycle-replace', 'stock-old', 'sip-old')
  )->>'ok')::boolean,
  'lifecycle replacement setup succeeds'
);
UPDATE public.bike_tasks t SET status = 'ready_for_pickup', version = 6
FROM public.orders o
WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-lifecycle-replace';
SELECT ok(
  (pg_temp.apply_snap(
    'bq-lifecycle-replace',
    pg_temp.fulfillment_snap(
      'bq-lifecycle-replace', 'started', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb,
      'stock-old', 'sip-old'
    )
  )->>'ok')::boolean,
  'old lifecycle observes source pickup'
);
SELECT ok(
  (pg_temp.apply_snap(
    'bq-lifecycle-replace',
    pg_temp.fulfillment_snap(
      'bq-lifecycle-replace', 'started', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb,
      'stock-new', 'sip-new'
    )
  )->>'ok')::boolean,
  'replacement source apply creates a fresh lifecycle'
);
SELECT is(
  (SELECT t.workshop_source_pickup_observed FROM public.bike_tasks t
   JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-lifecycle-replace' AND t.status <> 'cancelled'),
  false,
  'replacement task does not inherit prior lifecycle pickup evidence'
);
UPDATE public.bike_tasks t SET status = 'in_rental', version = version + 1
FROM public.orders o
WHERE o.id = t.order_id
  AND o.booqable_order_id = 'bq-lifecycle-replace'
  AND t.status <> 'cancelled';
SELECT ok(
  (pg_temp.apply_snap(
    'bq-lifecycle-replace',
    pg_temp.road_snap('bq-lifecycle-replace', 'stock-new', 'sip-new')
  )->>'ok')::boolean,
  'replacement lifecycle reserved refresh succeeds'
);
SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-lifecycle-replace' AND t.status <> 'cancelled')
  )->>'kind'),
  'local_ahead',
  'replacement lifecycle is ordinary local progress rather than reversal'
);

-- A proven upstream reversal preserves progress and is distinguished from a
-- normal manual transition that happened before Booqable caught up.
SELECT ok(
  (pg_temp.apply_snap('bq-reversal', pg_temp.road_snap('bq-reversal'))->>'ok')::boolean,
  'reversal setup succeeds'
);
UPDATE public.bike_tasks t SET status = 'ready_for_pickup', version = 4
FROM public.orders o WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-reversal';
SELECT ok(
  (pg_temp.apply_snap(
    'bq-reversal',
    pg_temp.fulfillment_snap(
      'bq-reversal', 'started', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb
    )
  )->>'ok')::boolean,
  'reversal setup records a confirmed pickup'
);

SELECT pg_temp.become('11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;
SELECT is(
  (public.workshop_mark_returned(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-reversal'),
    (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-reversal')
  )->>'status'),
  'returned',
  'manual return RPC remains available after source-driven pickup'
);
RESET ROLE;

SELECT ok(
  (pg_temp.apply_snap('bq-reversal', pg_temp.road_snap('bq-reversal'))->>'ok')::boolean,
  'reserved reversal apply succeeds'
);
SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-reversal'),
  'returned',
  'upstream reversal never moves a manually returned task backward'
);
SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-reversal')
  )->>'kind'),
  'reversal',
  'proven upstream reversal has the reversal notice'
);

SELECT ok(
  (pg_temp.apply_snap('bq-return-reversal', pg_temp.road_snap('bq-return-reversal'))->>'ok')::boolean,
  'return-reversal setup succeeds'
);
UPDATE public.bike_tasks t SET status = 'in_rental', version = 5
FROM public.orders o
WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-return-reversal';
SELECT ok(
  (pg_temp.apply_snap(
    'bq-return-reversal',
    pg_temp.fulfillment_snap(
      'bq-return-reversal', 'stopped', '["stopped"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":0,"stopped":2}'::jsonb
    )
  )->>'ok')::boolean,
  'source-driven final return records lifecycle return history'
);
SELECT ok(
  (pg_temp.apply_snap(
    'bq-return-reversal',
    pg_temp.fulfillment_snap(
      'bq-return-reversal', 'started', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb
    )
  )->>'ok')::boolean,
  'return reversal to full pickup applies without moving Workshop backward'
);
SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-return-reversal')
  )->>'kind'),
  'reversal',
  'task lifecycle with an observed source return exposes return-history reversal'
);

SELECT ok(
  (pg_temp.apply_snap('bq-manual-ahead', pg_temp.road_snap('bq-manual-ahead'))->>'ok')::boolean,
  'manual-ahead setup succeeds'
);
UPDATE public.bike_tasks t SET status = 'in_rental', version = 4
FROM public.orders o WHERE o.id = t.order_id AND o.booqable_order_id = 'bq-manual-ahead';
SELECT ok(
  (pg_temp.apply_snap('bq-manual-ahead', pg_temp.road_snap('bq-manual-ahead'))->>'ok')::boolean,
  'manual-ahead reserved refresh succeeds'
);
SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-manual-ahead')
  )->>'kind'),
  'local_ahead',
  'ordinary manual progress is not falsely labeled a reversal'
);

-- Contradictory aggregate evidence is valid-but-unknown; malformed evidence is
-- structurally invalid and preserves the previous source/task state.
SELECT is(
  private.booqable_source_fingerprint(
    pg_temp.fulfillment_snap(
      'fingerprint-order', 'started', '["started","reserved"]'::jsonb,
      '{"reserved":1,"started":1}'::jsonb
    )
  ),
  private.booqable_source_fingerprint(
    pg_temp.fulfillment_snap(
      'fingerprint-order', 'started', '["reserved","started"]'::jsonb,
      '{"started":1,"reserved":1}'::jsonb
    )
  ),
  'source fingerprint canonicalizes equivalent status sets'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-partial',
    pg_temp.fulfillment_snap(
      'bq-partial', 'started', '[]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":0,"stopped":0}'::jsonb
    )
  )->>'fulfillmentState'),
  'unknown',
  'empty status evidence never invents pickup'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-partial',
    pg_temp.fulfillment_snap(
      'bq-partial', 'started', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":1,"started":1,"stopped":0}'::jsonb
    )
  )->>'fulfillmentState'),
  'unknown',
  'contradictory aggregate evidence never invents pickup'
);

SELECT is(
  (pg_temp.apply_snap(
    'bq-partial',
    pg_temp.fulfillment_snap(
      'bq-partial', 'reserved', '["started"]'::jsonb,
      '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb
    )
  )->>'fulfillmentState'),
  'unknown',
  'contradictory reserved aggregates classify as unknown'
);

SELECT is(
  (private.workshop_task_source_notice(
    (SELECT t.id FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
     WHERE o.booqable_order_id = 'bq-partial')
  )->>'kind'),
  'unknown',
  'contradictory reserved aggregates expose the AC12 explanation'
);

CREATE TEMP TABLE malformed_before AS
SELECT t.status, t.version
FROM public.bike_tasks t
JOIN public.orders o ON o.id = t.order_id
WHERE o.booqable_order_id = 'bq-partial';

SELECT is(
  pg_temp.apply_snap(
    'bq-partial',
    jsonb_set(
      pg_temp.fulfillment_snap(
        'bq-partial', 'started', '["started"]'::jsonb,
        '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb
      ),
      '{order,statusCounts,started}', '"two"'::jsonb, true
    )
  )->>'code',
  'INVALID_SNAPSHOT',
  'malformed aggregate counts reject the entire snapshot'
);

SELECT is(
  (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-partial'),
  (SELECT version FROM malformed_before),
  'malformed aggregate snapshot writes no task change'
);

SELECT is(
  pg_temp.apply_snap(
    'bq-partial',
    jsonb_set(
      pg_temp.fulfillment_snap(
        'bq-partial', 'started', '["started"]'::jsonb,
        '{"draft":0,"new":0,"reserved":0,"started":2,"stopped":0}'::jsonb
      ),
      '{order,statusCounts,started}', '9223372036854775808'::jsonb, true
    )
  )->>'code',
  'INVALID_SNAPSHOT',
  'count beyond bigint range follows the invalid-snapshot contract'
);

SELECT is(
  (SELECT t.version FROM public.bike_tasks t JOIN public.orders o ON o.id = t.order_id
   WHERE o.booqable_order_id = 'bq-partial'),
  (SELECT version FROM malformed_before),
  'oversized count writes no task change'
);

SELECT is(
  (SELECT is_nullable FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'orders'
     AND column_name = 'workshop_fulfillment_evidence_observed'),
  'NO',
  'evidence-observed column converges to not-null on migration replay'
);

SELECT is(
  (SELECT column_default FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'bike_tasks'
     AND column_name = 'workshop_source_pickup_observed'),
  'false',
  'task lifecycle evidence column converges to a false default on replay'
);

-- Bad envelope: missing assignments
CREATE TEMP TABLE orders_before_bad AS
SELECT count(*)::integer AS n FROM public.orders WHERE booqable_order_id = 'bq-bad';

SELECT is(
  pg_temp.apply_snap(
    'bq-bad',
    jsonb_build_object(
      'schemaVersion', 1,
      'fetchedAt', '2026-08-21T14:00:00.000Z',
      'sourceStatus', 'reserved',
      'order', jsonb_build_object('booqableOrderId', 'bq-bad'),
      'lines', '[]'::jsonb
    )
  )->>'code',
  'INVALID_SNAPSHOT',
  'missing assignments returns INVALID_SNAPSHOT'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE booqable_order_id = 'bq-bad'),
  (SELECT n FROM orders_before_bad),
  'missing assignments writes nothing'
);

SELECT is(
  pg_temp.apply_snap(
    'bq-bad-next',
    pg_temp.road_snap('bq-bad-next') || jsonb_build_object(
      'links', jsonb_build_object('next', 'https://example.test/page=2')
    )
  )->>'code',
  'INVALID_SNAPSHOT',
  'links.next without pages returns INVALID_SNAPSHOT'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE booqable_order_id = 'bq-bad-next'),
  0,
  'links.next writes nothing'
);

SELECT is(
  pg_temp.apply_snap(
    'bq-bad-cast',
    jsonb_set(pg_temp.road_snap('bq-bad-cast'), '{order,startsAt}', '"not-a-timestamp"')
  )->>'code',
  'INVALID_SNAPSHOT',
  'invalid startsAt returns INVALID_SNAPSHOT'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE booqable_order_id = 'bq-bad-cast'),
  0,
  'invalid startsAt writes nothing'
);

-- Bad lease
SELECT ok(
  ((pg_temp.ensure_lease('bq-stale')).token IS NOT NULL),
  'stale-lease setup acquired a token'
);

SELECT is(
  public.booqable_apply_source_snapshot_v1(
    'bq-stale',
    '00000000-0000-4000-8000-000000000099'::uuid,
    1,
    pg_temp.road_snap('bq-stale')
  )->>'code',
  'STALE_LEASE',
  'wrong token returns STALE_LEASE'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE booqable_order_id = 'bq-stale'),
  0,
  'wrong token writes nothing'
);

UPDATE private.booqable_order_leases
SET expires_at = now() - interval '1 second'
WHERE booqable_order_id = 'bq-stale';

SELECT is(
  public.booqable_apply_source_snapshot_v1(
    'bq-stale',
    (SELECT token FROM apply_leases WHERE order_id = 'bq-stale'),
    (SELECT fence FROM apply_leases WHERE order_id = 'bq-stale'),
    pg_temp.road_snap('bq-stale')
  )->>'code',
  'STALE_LEASE',
  'expired token returns STALE_LEASE'
);

-- Staff JWT has no EXECUTE grant
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.booqable_apply_source_snapshot_v1(text,uuid,bigint,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on apply'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.booqable_acquire_order_lease(text,timestamptz,text)',
    'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on acquire'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE booqable_order_id = 'bq-authz'),
  0,
  'staff JWT apply writes nothing'
);

-- Empty extras still fingerprint
SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-empty-extra',
      pg_temp.snap(
        'bq-empty-extra',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment('stock-e', 'sip-e', '["workshop-road-bike"]'::jsonb)
        ),
        jsonb_build_array()
      )
    )->>'ok'
  )::boolean,
  'empty add-on list still applies'
);

SELECT isnt(
  (SELECT addon_fingerprint FROM public.orders WHERE booqable_order_id = 'bq-empty-extra'),
  NULL,
  'empty add-on list still has a fingerprint'
);

-- Enabling a mapping must re-resolve on an unchanged snapshot
UPDATE public.checklist_tag_mappings
SET enabled = false,
    definition_id = NULL
WHERE tag = 'workshop-e-city-bike';
SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-map-enable',
      pg_temp.snap(
        'bq-map-enable',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment(
            'stock-me',
            'sip-me',
            '["workshop-e-city-bike"]'::jsonb,
            'ECF/M-1',
            'E-city'
          )
        ),
        jsonb_build_array(pg_temp.line('e-city-bike', 'E-city', 1))
      )
    )->>'ok'
  )::boolean,
  'e-city setup succeeds'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-map-enable'
  ),
  true,
  'e-city starts with configuration warning'
);

UPDATE public.checklist_tag_mappings
SET enabled = true,
    definition_id = (
      SELECT d.id
      FROM public.checklist_definitions d
      WHERE d.definition_key = 'e_city_bike_preparation' AND d.version = 2
    )
WHERE tag = 'workshop-e-city-bike';

SELECT ok(
  (
    pg_temp.apply_snap(
      'bq-map-enable',
      pg_temp.snap(
        'bq-map-enable',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.assignment(
            'stock-me',
            'sip-me',
            '["workshop-e-city-bike"]'::jsonb,
            'ECF/M-1',
            'E-city'
          )
        ),
        jsonb_build_array(pg_temp.line('e-city-bike', 'E-city', 1))
      )
    )->>'ok'
  )::boolean,
  'unchanged snapshot after mapping enable applies'
);

SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-map-enable'
  ),
  false,
  'mapping enable on unchanged snapshot clears warning'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-map-enable'
      AND i.stage = 'preparation'
  ),
  23,
  'mapping enable on unchanged snapshot copies e-city items'
);

-- Partner qty 2 → qty 1 retain/cancel
SELECT is(
  (
    pg_temp.apply_snap(
      'bq-partner',
      pg_temp.snap(
        'bq-partner',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.partner_assignment('bq-partner-bike', 1),
          pg_temp.partner_assignment('bq-partner-bike', 2)
        ),
        jsonb_build_array(pg_temp.line('bq-partner-bike', 'Partner Canyon', 2))
      )
    )->>'created'
  )::integer,
  2,
  'partner qty-2 mints two tasks'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-partner'
      AND t.status = 'to_prepare'
      AND t.bike_display_id = 'Partner Bike'
      AND t.bike_title = 'Partner Canyon'
      AND t.workshop_tag = 'workshop-partner-bike'
  ),
  2,
  'partner qty-2 tasks use Partner Bike display, line title, and partner tag'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    JOIN public.bike_tasks t ON t.id = i.task_id
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-partner'
      AND i.stage = 'preparation'
  ),
  12,
  'partner qty-2 copies 6 items per task'
);

SELECT is(
  (
    pg_temp.apply_snap(
      'bq-partner',
      pg_temp.snap(
        'bq-partner',
        'reserved',
        '2026-12-10T10:00:00Z',
        jsonb_build_array(
          pg_temp.partner_assignment('bq-partner-bike', 1)
        ),
        jsonb_build_array(pg_temp.line('bq-partner-bike', 'Partner Canyon', 1))
      )
    )->>'cancelled'
  )::integer,
  1,
  'partner qty 2→1 cancels :2'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-partner'
      AND t.booqable_stock_item_id = 'partner:bq-partner-bike:1'
  ),
  'to_prepare',
  'partner qty 2→1 retains :1'
);

SELECT is(
  (
    SELECT t.status::text
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'bq-partner'
      AND t.booqable_stock_item_id = 'partner:bq-partner-bike:2'
  ),
  'cancelled',
  'partner qty 2→1 cancels :2 task'
);

SELECT * FROM finish();
ROLLBACK;
