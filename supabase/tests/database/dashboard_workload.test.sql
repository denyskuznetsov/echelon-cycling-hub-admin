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

-- Story 1.2: exact urgency thresholds reuse the caller's reference instant.
WITH refs(label, reference_at, severity) AS (VALUES
  ('over six hours', timestamptz '2034-06-18 02:59:00+02', 'low'),
  ('exactly six hours', timestamptz '2034-06-18 03:00:00+02', 'warning'),
  ('over two hours', timestamptz '2034-06-18 06:59:00+02', 'warning'),
  ('exactly two hours', timestamptz '2034-06-18 07:00:00+02', 'critical'),
  ('overdue', timestamptz '2034-06-18 10:00:00+02', 'critical')
)
SELECT is(
  (SELECT c->>'severity' FROM jsonb_array_elements(public.dashboard_workload('2034-06-18', '2034-06-18', refs.reference_at) #> '{outgoing,days,0,rows,0,conditions}') c WHERE c->>'kind' = 'preparation'),
  refs.severity,
  'preparation urgency at ' || refs.label
) FROM refs;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 101 && @.preparation_task_count == 2 && @.conditions[*].affected_bikes == 2)'),
  'mixed ready, preparation and completed tasks report actual preparation bike count') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(
  jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == null && @.task_count == 0)')
  AND NOT jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == null && @.conditions[*].kind == "preparation")'),
  'zero-task order has no preparation condition') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 106 && @.conditions[*].kind == "missing_delivery_address")'),
  'missing delivery condition remains on the row') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-17 12:00:00+02') AS result)
SELECT ok(NOT jsonb_path_exists(result, '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "preparation")'),
  'tomorrow preparation remains informational') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-17 12:00:00+02') AS result)
SELECT ok(jsonb_path_exists(result, '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "missing_delivery_address" && @.severity == "warning")'),
  'tomorrow missing delivery destination remains prominent') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-19', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(NOT jsonb_path_exists(result, '$.incoming.days[*].rows[*].conditions[*] ? (@.kind == "missing_delivery_address")'),
  'return rows do not carry outgoing delivery address urgency') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 101 && @.conditions[0].kind == "preparation" && @.conditions[0].severity == "critical")'),
  'row conditions put critical preparation before warning and low notices') FROM workload;
RESET ROLE;
UPDATE public.bike_tasks SET has_configuration_warning = true
WHERE assignment_instance_id = '70000000-0000-4000-8000-000000000202';
UPDATE public.orders SET workshop_fulfillment_state = 'mixed'
WHERE id = '70000000-0000-4000-8000-000000000101';
SET LOCAL ROLE authenticated;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 101 && @.conditions[*].kind == "configuration_warning" && @.conditions[*].kind == "source_mixed")'),
  'configuration warning and evidenced source notice remain distinct') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 02:59:00+02') AS result)
SELECT ok(jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 101 && @.conditions[0].severity == "warning" && @.conditions[last].severity == "low")'),
  'warning source/configuration notices sort before low preparation notice') FROM workload;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT is((SELECT (c->>'orders')::integer FROM jsonb_array_elements(result #> '{attention}') c WHERE c->>'kind' = 'source_mixed'), 1,
  'source notice is deduplicated across the outgoing and incoming row for one order') FROM workload;
RESET ROLE;
UPDATE public.orders SET status = 'stopped' WHERE id = '70000000-0000-4000-8000-000000000101';
UPDATE public.bike_tasks SET status = 'returned' WHERE assignment_instance_id IN (
  '70000000-0000-4000-8000-000000000202', '70000000-0000-4000-8000-000000000205');
SET LOCAL ROLE authenticated;
WITH workload AS (SELECT public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') AS result)
SELECT ok(NOT jsonb_path_exists(result, '$.outgoing.days[*].rows[*] ? (@.order_number == 101 && @.conditions[*].kind == "preparation")'),
  'later task lifecycle does not escalate preparation even on a stopped outgoing order') FROM workload;
RESET ROLE;
UPDATE public.orders SET status = 'reserved' WHERE id = '70000000-0000-4000-8000-000000000101';
UPDATE public.bike_tasks SET status = 'to_prepare' WHERE assignment_instance_id IN (
  '70000000-0000-4000-8000-000000000202', '70000000-0000-4000-8000-000000000205');
SET LOCAL ROLE authenticated;

-- The six source notice kinds follow the current task's evidence, not needs_recheck alone.
RESET ROLE;
UPDATE public.orders SET workshop_fulfillment_state = 'unknown', workshop_fulfillment_evidence_observed = true
WHERE id = '70000000-0000-4000-8000-000000000101';
SET LOCAL ROLE authenticated;
SELECT ok(jsonb_path_exists(public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02'),
  '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "source_unknown")'), 'unknown source notice has observed evidence');
RESET ROLE;
UPDATE public.orders SET workshop_fulfillment_state = 'full_pickup' WHERE id = '70000000-0000-4000-8000-000000000101';
SET LOCAL ROLE authenticated;
SELECT ok(jsonb_path_exists(public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02'),
  '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "source_pickup_ahead")'), 'pickup ahead notice uses current preparation tasks');
RESET ROLE;
UPDATE public.orders SET workshop_fulfillment_state = 'final_return' WHERE id = '70000000-0000-4000-8000-000000000101';
SET LOCAL ROLE authenticated;
SELECT ok(jsonb_path_exists(public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02'),
  '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "source_missed_pickup")'), 'final return ahead of Workshop is an evidenced notice');
RESET ROLE;
UPDATE public.orders SET workshop_fulfillment_state = 'reserved' WHERE id = '70000000-0000-4000-8000-000000000101';
UPDATE public.bike_tasks SET status = 'in_rental', workshop_source_pickup_observed = true
WHERE assignment_instance_id = '70000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;
SELECT ok(jsonb_path_exists(public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02'),
  '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "source_reversal")'), 'source reversal is evidenced by observed pickup');
RESET ROLE;
UPDATE public.bike_tasks SET workshop_source_pickup_observed = false
WHERE assignment_instance_id = '70000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;
SELECT ok(jsonb_path_exists(public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02'),
  '$.outgoing.days[*].rows[*].conditions[*] ? (@.kind == "source_local_ahead")'), 'local Workshop progress ahead of reserved source has a notice');
RESET ROLE;
UPDATE public.bike_tasks SET status = 'ready_for_pickup' WHERE assignment_instance_id = '70000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;

SELECT is((SELECT count(*)::integer FROM public.dashboard_order_current_tasks('70000000-0000-4000-8000-000000000101')), 4,
  'selected order links include current non-cancelled tasks, including completed and partner bike tasks');
SELECT is((SELECT count(*)::integer FROM public.dashboard_order_current_tasks('70000000-0000-4000-8000-000000000102')), 0,
  'selected order read has no cross-order task leakage');
SELECT ok((SELECT bool_and(task_id IS NOT NULL AND status IS NOT NULL) FROM public.dashboard_order_current_tasks('70000000-0000-4000-8000-000000000101')),
  'selected task links carry identity and status');
CREATE TEMP TABLE dashboard_read_snapshot AS
SELECT (SELECT to_jsonb(o) FROM public.orders o WHERE o.id = '70000000-0000-4000-8000-000000000101') AS order_data,
       (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.bike_tasks t
        WHERE t.order_id = '70000000-0000-4000-8000-000000000101') AS task_data;
SELECT ok(public.dashboard_workload('2034-06-18', '2034-06-18', timestamptz '2034-06-18 08:00:00+02') IS NOT NULL,
  'workload read succeeds before state comparison');
SELECT is((SELECT count(*)::integer FROM public.dashboard_order_current_tasks('70000000-0000-4000-8000-000000000101')), 4,
  'task links read succeeds before state comparison');
SELECT is((SELECT order_data FROM dashboard_read_snapshot),
  (SELECT to_jsonb(o) FROM public.orders o WHERE o.id = '70000000-0000-4000-8000-000000000101'),
  'workload and task-link reads leave the selected order unchanged');
SELECT is((SELECT task_data FROM dashboard_read_snapshot),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.bike_tasks t
   WHERE t.order_id = '70000000-0000-4000-8000-000000000101'),
  'workload and task-link reads leave current and historical tasks unchanged');

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
SELECT throws_ok($$SELECT * FROM public.dashboard_order_current_tasks('70000000-0000-4000-8000-000000000101')$$, '42501', 'Dashboard task links are restricted to staff', 'partner direct task read denied');
RESET ROLE;

SELECT pg_temp.become('70000000-0000-4000-8000-000000000099');
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.dashboard_workload('2034-06-18', '2034-06-18', now())$$,
  '42501',
  'Dashboard workload is restricted to staff',
  'pending callers cannot obtain dashboard data through the RPC'
);
SELECT throws_ok($$SELECT * FROM public.dashboard_order_current_tasks('70000000-0000-4000-8000-000000000101')$$, '42501', 'Dashboard task links are restricted to staff', 'pending direct task read denied');
RESET ROLE;

SELECT ok(NOT has_function_privilege('anon', 'public.dashboard_order_current_tasks(uuid)', 'EXECUTE'),
  'anonymous role has no execute grant for selected task links');

SELECT * FROM finish();
ROLLBACK;
