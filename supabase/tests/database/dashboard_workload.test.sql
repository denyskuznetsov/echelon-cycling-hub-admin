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
    json_build_object('sub', p_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
END;
$$;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) VALUES (
  '70000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'dashboard-staff@example.test', 'x', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false
);
UPDATE public.profiles
SET role = 'mechanic'
WHERE id = '70000000-0000-4000-8000-000000000001';

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) VALUES
  ('70000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dashboard-admin@example.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('70000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dashboard-manager@example.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('70000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dashboard-partner@example.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

INSERT INTO public.partners (id, name, slug)
VALUES ('70000000-0000-4000-8000-000000000020', 'Dashboard test partner', 'dashboard-test-partner');

UPDATE public.profiles
SET role = 'admin'
WHERE id = '70000000-0000-4000-8000-000000000002';
UPDATE public.profiles
SET role = 'manager'
WHERE id = '70000000-0000-4000-8000-000000000003';
UPDATE public.profiles
SET role = 'partner', partner_id = '70000000-0000-4000-8000-000000000020'
WHERE id = '70000000-0000-4000-8000-000000000004';

INSERT INTO public.customers (id, name, email)
VALUES ('70000000-0000-4000-8000-000000000010', 'Dashboard customer', 'dashboard-customer@example.test');

INSERT INTO public.orders (
  id, booqable_order_id, order_number, status, fulfillment_type, starts_at, stops_at,
  customer_id, delivery_address, maps_link_order
) VALUES
  ('70000000-0000-4000-8000-000000000101', 'dashboard-ready', 101, 'reserved', 'delivery',
   timestamptz '2034-06-18 09:00:00+02', timestamptz '2034-06-18 17:00:00+02',
   '70000000-0000-4000-8000-000000000010', '   ', 'https://maps.example.test/destination'),
  ('70000000-0000-4000-8000-000000000102', 'dashboard-zero', NULL, 'started', 'delivery',
   timestamptz '2034-06-18 10:00:00+02', timestamptz '2034-06-19 10:00:00+02',
   NULL, ' ', NULL),
  ('70000000-0000-4000-8000-000000000103', 'dashboard-pickup', 103, 'stopped', 'pickup',
   timestamptz '2034-06-18 11:00:00+02', timestamptz '2034-06-18 15:00:00+02',
   NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000105', 'dashboard-incoming-only', 105, 'reserved', 'pickup',
   timestamptz '2034-06-17 11:00:00+02', timestamptz '2034-06-18 16:00:00+02',
   NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000104', 'dashboard-draft', 104, 'draft', 'delivery',
   timestamptz '2034-06-18 12:00:00+02', timestamptz '2034-06-18 14:00:00+02',
   NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000106', 'dashboard-tab-whitespace', 106, 'reserved', 'delivery',
   timestamptz '2034-06-18 13:00:00+02', timestamptz '2034-06-18 18:00:00+02',
   NULL, E'\t\n', E'\r\n'),
  ('70000000-0000-4000-8000-000000000107', 'dashboard-dst-spring-in', 107, 'reserved', 'pickup',
   timestamptz '2026-03-28 23:30:00+00', timestamptz '2026-03-29 21:30:00+00',
   NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000108', 'dashboard-dst-spring-out', 108, 'reserved', 'pickup',
   timestamptz '2026-03-29 22:30:00+00', timestamptz '2026-03-30 21:30:00+00',
   NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000109', 'dashboard-dst-autumn-in', 109, 'reserved', 'pickup',
   timestamptz '2026-10-24 22:30:00+00', timestamptz '2026-10-25 22:30:00+00',
   NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000110', 'dashboard-dst-autumn-out', 110, 'reserved', 'pickup',
   timestamptz '2026-10-25 23:30:00+00', timestamptz '2026-10-26 22:30:00+00',
   NULL, NULL, NULL);

INSERT INTO public.orders (id, booqable_order_id, status, fulfillment_type, starts_at, stops_at)
SELECT gen_random_uuid(), 'dashboard-bulk-' || n, 'reserved', 'pickup',
  timestamptz '2034-06-20 09:00:00+02', timestamptz '2034-06-21 09:00:00+02'
FROM generate_series(1, 1001) AS n;

INSERT INTO public.booqable_assignment_instances (
  id, order_id, booqable_stock_item_id, bike_display_id, bike_title, closed_at
) VALUES
  ('70000000-0000-4000-8000-000000000201', '70000000-0000-4000-8000-000000000101', 'dashboard-ready-bike', 'D-1', 'Ready bike', NULL),
  ('70000000-0000-4000-8000-000000000202', '70000000-0000-4000-8000-000000000101', 'dashboard-prep-bike', 'D-2', 'Prep bike', NULL),
  ('70000000-0000-4000-8000-000000000203', '70000000-0000-4000-8000-000000000101', 'dashboard-complete-bike', 'D-3', 'Complete bike', NULL),
  ('70000000-0000-4000-8000-000000000205', '70000000-0000-4000-8000-000000000101', 'partner:dashboard:1', 'Partner-1', 'Partner bike', NULL),
  ('70000000-0000-4000-8000-000000000204', '70000000-0000-4000-8000-000000000101', 'dashboard-history-bike', 'D-4', 'Historical bike', now());

INSERT INTO public.bike_tasks (
  assignment_instance_id, order_id, order_number, booqable_stock_item_id,
  bike_display_id, bike_title, status
) VALUES
  ('70000000-0000-4000-8000-000000000201', '70000000-0000-4000-8000-000000000101', 101, 'dashboard-ready-bike', 'D-1', 'Ready bike', 'ready_for_pickup'),
  ('70000000-0000-4000-8000-000000000202', '70000000-0000-4000-8000-000000000101', 101, 'dashboard-prep-bike', 'D-2', 'Prep bike', 'to_prepare'),
  ('70000000-0000-4000-8000-000000000203', '70000000-0000-4000-8000-000000000101', 101, 'dashboard-complete-bike', 'D-3', 'Complete bike', 'completed'),
  ('70000000-0000-4000-8000-000000000205', '70000000-0000-4000-8000-000000000101', 101, 'partner:dashboard:1', 'Partner-1', 'Partner bike', 'to_prepare'),
  ('70000000-0000-4000-8000-000000000204', '70000000-0000-4000-8000-000000000101', 101, 'dashboard-history-bike', 'D-4', 'Historical bike', 'cancelled');

INSERT INTO public.bike_task_items (task_id, stage, item_key, sort_order, label, item_type)
SELECT id, 'preparation', 'fanout-proof', 1, 'Fan-out must not change task count', 'action'
FROM public.bike_tasks
WHERE assignment_instance_id = '70000000-0000-4000-8000-000000000202';

SELECT pg_temp.become('70000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;

WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,totals,orders}')::integer, 4, 'eligible outgoing orders include reserved, started, and stopped but not draft') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{incoming,totals,orders}')::integer, 4, 'incoming workload independently includes orders that stop in the selected period') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT ok(
  jsonb_path_exists(result, '$.incoming.days[*].rows[*] ? (@.order_number == 105)'),
  'an incoming-only order is returned under its local stop date'
) FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,totals,bikes}')::integer, 4, 'open current task count includes completed and partner units but excludes closed and cancelled work despite checklist rows') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,totals,outstanding_preparation}')::integer, 2, 'only current preparation-stage tasks count as outstanding') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,totals,deliveries}')::integer, 3, 'delivery totals exclude pickup rows') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,totals,missing_delivery_addresses}')::integer, 2, 'all-whitespace delivery inputs count as missing') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is(
  result #>> '{outgoing,days,0,rows,0,delivery_kind}',
  'maps',
  'maps link is the nonblank fallback after a whitespace delivery address'
) FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT ok(
  jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == null && @.task_count == 0)'),
  'missing order number and zero-task order remain in the workload'
) FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT ok(
  jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 106 && @.delivery_kind == "missing")'),
  'tab and newline-only delivery values are missing in SQL as in the drawer'
) FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,days,0,rows,0,minutes_from_reference}')::integer, 60,
  'today-relative minutes come from the same reference instant as the workload') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2026-03-29', '2026-03-29', timestamptz '2026-03-29 12:00:00+02') AS result
)
SELECT is((result #>> '{outgoing,totals,orders}')::integer, 1,
  'spring DST day includes its local start and excludes the next local day') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2026-10-25', '2026-10-25', timestamptz '2026-10-25 12:00:00+01') AS result
)
SELECT is((result #>> '{outgoing,totals,orders}')::integer, 1,
  'autumn DST day includes its local start and excludes the next local day') FROM workload;
WITH workload AS (
  SELECT public.dashboard_workload('2034-06-20', '2034-06-20', timestamptz '2034-06-20 08:00:00+02') AS result
)
SELECT is(jsonb_array_length(result #> '{outgoing,days,0,rows}'), 1001,
  'the JSON workload retains more than one API page of rows') FROM workload;

RESET ROLE;
SELECT pg_temp.become('70000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.dashboard_workload('2034-06-18', '2034-06-18', now())$$,
  'admins can read dashboard workload through the RPC'
);
RESET ROLE;

SELECT pg_temp.become('70000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.dashboard_workload('2034-06-18', '2034-06-18', now())$$,
  'managers can read dashboard workload through the RPC'
);
RESET ROLE;

SELECT pg_temp.become('70000000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.dashboard_workload('2034-06-18', '2034-06-18', now())$$,
  '42501',
  'Dashboard workload is restricted to staff',
  'partner callers cannot obtain dashboard data through the RPC'
);
RESET ROLE;

SELECT pg_temp.become('70000000-0000-4000-8000-000000000099');
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.dashboard_workload('2034-06-18', '2034-06-18', now())$$,
  '42501',
  'Dashboard workload is restricted to staff',
  'pending callers cannot obtain dashboard data through the RPC'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
