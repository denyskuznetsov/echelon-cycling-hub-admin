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
  p_qty integer
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'booqableLineId', p_id,
    'booqableItemId', 'item-' || p_id,
    'parentBooqableLineId', NULL,
    'title', p_title,
    'quantity', p_qty,
    'lineType', 'charge',
    'chargeLabel', NULL,
    'extraInformation', NULL,
    'priceEachInCents', 0,
    'priceInCents', 0,
    'position', 1,
    'relevant', true,
    'createdAt', '2026-08-01T09:00:00Z',
    'updatedAt', '2026-08-01T09:00:00Z'
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.assignment(p_stock text, p_sip text)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'stockItemId', p_stock,
    'sipId', p_sip,
    'displayId', 'RF-1',
    'title', 'Road Bike',
    'workshopTags', '["workshop-road-bike"]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.snap(
  p_order_id text,
  p_status text,
  p_stock text DEFAULT 'stock-sync',
  p_sip text DEFAULT 'sip-sync'
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'fetchedAt', '2026-08-22T10:00:00.000Z',
    'sourceStatus', p_status,
    'order', jsonb_build_object(
      'booqableOrderId', p_order_id,
      'orderNumber', 410,
      'status', p_status,
      'startsAt', '2026-12-10T10:00:00Z',
      'stopsAt', '2026-12-12T17:00:00Z',
      'createdAt', '2026-08-01T09:00:00Z',
      'updatedAt', '2026-08-22T09:00:00Z',
      'fulfillmentType', 'pickup',
      'deliveryAddress', NULL,
      'billingAddress', NULL,
      'mapsLinkOrder', NULL,
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
      'itemCount', 1
    ),
    'customer', jsonb_build_object(
      'booqableCustomerId', 'cust-' || p_order_id,
      'name', 'Sync Rider',
      'email', 'sync@example.test',
      'phone', NULL,
      'birthday', NULL,
      'createdAt', '2026-01-01T00:00:00Z',
      'updatedAt', '2026-08-01T00:00:00Z'
    ),
    'coupon', NULL,
    'lines', jsonb_build_array(pg_temp.line(p_order_id || '-bike', 'Road Bike', 1)),
    'assignments', jsonb_build_array(pg_temp.assignment(p_stock, p_sip))
  );
$$;

SELECT pg_temp.create_staff(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'mech-sync@example.test',
  'Mo',
  'Mechanic',
  'mechanic'
);
SELECT pg_temp.create_staff(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'partner-sync@example.test',
  'Pat',
  'Partner',
  'partner'
);
SELECT pg_temp.create_staff(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'pending-sync@example.test', 'Pen', 'Pending', NULL::public.user_role
);

-- Order lease renew / release / overlap
SELECT is(
  public.booqable_acquire_order_lease(
    'sync-lease-1', now() + interval '2 minutes', 'test'
  )->>'ok',
  'true',
  'acquire order lease succeeds'
);

CREATE TEMP TABLE sync_lease AS
SELECT
  (public.booqable_acquire_order_lease(
    'sync-lease-renew', now() + interval '2 minutes', 'test'
  )) AS payload;

SELECT is(
  public.booqable_renew_order_lease(
    'sync-lease-renew',
    ((SELECT payload FROM sync_lease)->>'token')::uuid,
    ((SELECT payload FROM sync_lease)->>'fence')::bigint,
    now() + interval '2 minutes'
  )->>'ok',
  'true',
  'renew with same token/fence succeeds'
);

SELECT is(
  public.booqable_renew_order_lease(
    'sync-lease-renew',
    ((SELECT payload FROM sync_lease)->>'token')::uuid,
    ((SELECT payload FROM sync_lease)->>'fence')::bigint + 1,
    now() + interval '2 minutes'
  )->>'code',
  'STALE_LEASE',
  'renew with wrong fence returns STALE_LEASE'
);

SELECT is(
  public.booqable_acquire_order_lease(
    'sync-lease-renew', now() + interval '2 minutes', 'other'
  )->>'code',
  'SYNC_IN_PROGRESS',
  'second acquire on unexpired lease returns SYNC_IN_PROGRESS'
);

SELECT is(
  public.booqable_release_order_lease(
    'sync-lease-renew',
    ((SELECT payload FROM sync_lease)->>'token')::uuid,
    ((SELECT payload FROM sync_lease)->>'fence')::bigint
  )->>'ok',
  'true',
  'release with same token/fence succeeds'
);

SELECT is(
  public.booqable_acquire_order_lease(
    'sync-lease-renew', now() + interval '2 minutes', 'after-release'
  )->>'ok',
  'true',
  'acquire succeeds after release'
);

-- Staff start vs partner
SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;

SELECT is(
  public.workshop_start_manual_sync('next_7_days')->>'ok',
  'true',
  'mechanic can start manual sync'
);

RESET ROLE;

CREATE TEMP TABLE started_run AS
SELECT id, scope, state
FROM public.booqable_sync_runs
ORDER BY created_at DESC
LIMIT 1;
GRANT SELECT ON started_run TO authenticated;

SELECT is(
  (SELECT scope FROM started_run),
  'next_7_days',
  'start records next_7_days scope'
);

SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;

SELECT is(
  public.workshop_start_manual_sync('all_reserved')->>'code',
  'SOURCE_UNAVAILABLE',
  'retired all_reserved start is rejected before lease acquisition'
);

RESET ROLE;

-- Release the run lease held by start so later tests can acquire.
SELECT ok(
  (
    SELECT private.booqable_release_run_lease(
      'manual_sync',
      l.token,
      l.fence
    )->>'ok' = 'true'
    FROM private.booqable_run_leases l
    WHERE l.lock_key = 'manual_sync'
  ),
  'test can release the staff run lease'
);

SELECT pg_temp.become('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SET ROLE authenticated;

SELECT is(
  public.workshop_start_manual_sync('next_7_days')->>'code',
  'FORBIDDEN',
  'partner start returns FORBIDDEN'
);

SELECT is(
  public.workshop_resume_manual_sync(
    (SELECT id FROM started_run),
    'next_7_days'
  )->>'code',
  'FORBIDDEN',
  'partner resume returns FORBIDDEN'
);

RESET ROLE;

-- Resume scope mismatch after a failed/resumable run
UPDATE public.booqable_sync_runs
SET state = 'failed',
    cursor = 'opaque-cursor'
WHERE id = (SELECT id FROM started_run);

SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;

SELECT is(
  public.workshop_resume_manual_sync(
    (SELECT id FROM started_run),
    'all_reserved'
  )->>'code',
  'SOURCE_UNAVAILABLE',
  'resume with a different scope requires restart'
);

SELECT is(
  public.workshop_resume_manual_sync(
    (SELECT id FROM started_run),
    'next_7_days'
  )->>'ok',
  'true',
  'mechanic can resume the same scope'
);

RESET ROLE;

SELECT ok(
  (
    SELECT private.booqable_release_run_lease(
      'manual_sync',
      l.token,
      l.fence
    )->>'ok' = 'true'
    FROM private.booqable_run_leases l
    WHERE l.lock_key = 'manual_sync'
  ),
  'release resume lease'
);

-- Grants: staff vs backend-only
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.workshop_start_manual_sync(text)',
    'EXECUTE'
  ),
  true,
  'authenticated has EXECUTE on start'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.workshop_resume_manual_sync(uuid,text)',
    'EXECUTE'
  ),
  true,
  'authenticated has EXECUTE on resume'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.booqable_renew_order_lease(text,uuid,bigint,timestamp with time zone)',
    'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on order renew'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.booqable_release_order_lease(text,uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on order release'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.booqable_record_sync_result(uuid,text,boolean,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on record'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.booqable_apply_source_snapshot_v1(text,uuid,bigint,jsonb,boolean)',
    'EXECUTE'
  ),
  false,
  'authenticated has no EXECUTE on mint_tasks apply'
);

-- Full success advances last_success_at; partial does not
CREATE TEMP TABLE health_before AS
SELECT last_success_at FROM public.booqable_sync_health WHERE id = 'workshop';

INSERT INTO public.booqable_sync_runs (id, scope, state)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'all_reserved',
  'in_progress'
);

SELECT is(
  public.booqable_record_sync_result(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'order-ok',
    true,
    NULL,
    NULL,
    false
  )->>'code',
  'SOURCE_UNAVAILABLE',
  'retired all_reserved run rejects new results'
);

SELECT is(
  public.booqable_finish_sync_run(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    NULL,
    NULL,
    false
  )->>'code',
  'SOURCE_UNAVAILABLE',
  'retired all_reserved run cannot finish as succeeded'
);

SELECT is(
  (SELECT last_success_at FROM public.booqable_sync_health WHERE id = 'workshop'),
  (SELECT last_success_at FROM health_before),
  'retired all_reserved does not advance last_success_at'
);

INSERT INTO public.booqable_sync_runs (id, scope, state)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'next_7_days',
  'in_progress'
);

CREATE TEMP TABLE health_after_full AS
SELECT last_success_at FROM public.booqable_sync_health WHERE id = 'workshop';

SELECT is(
  public.booqable_record_sync_result(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'order-fail',
    false,
    'SOURCE_UNAVAILABLE',
    'fetch failed',
    false
  )->>'ok',
  'true',
  'record failure for an order'
);

SELECT is(
  public.booqable_finish_sync_run(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'cursor-page-2',
    'fetch failed',
    false
  )->>'state',
  'failed',
  'partial finish stays failed/resumable'
);

SELECT is(
  (SELECT cursor FROM public.booqable_sync_runs WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'cursor-page-2',
  'partial run keeps a resume cursor'
);

SELECT is(
  (SELECT last_success_at FROM public.booqable_sync_health WHERE id = 'workshop'),
  (SELECT last_success_at FROM health_after_full),
  'partial run does not advance last_success_at'
);

-- Sandbox skip-task-mint: commercial rows, no new bike_tasks
CREATE TEMP TABLE mint_lease AS
SELECT public.booqable_acquire_order_lease(
  'sync-stopped', now() + interval '2 minutes', 'sandbox'
) AS payload;

SELECT is(
  public.booqable_apply_source_snapshot_v1(
    'sync-stopped',
    ((SELECT payload FROM mint_lease)->>'token')::uuid,
    ((SELECT payload FROM mint_lease)->>'fence')::bigint,
    pg_temp.snap('sync-stopped', 'stopped'),
    false
  )->>'ok',
  'true',
  'stopped apply with mint_tasks false succeeds'
);

SELECT is(
  (SELECT status::text FROM public.orders WHERE booqable_order_id = 'sync-stopped'),
  'stopped',
  'stopped sandbox updates the commercial order row'
);

SELECT is(
  (SELECT count(*)::integer FROM public.customers WHERE booqable_customer_id = 'cust-sync-stopped'),
  1,
  'stopped sandbox upserts the customer'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'sync-stopped'
  ),
  0,
  'stopped sandbox does not mint bike_tasks'
);

-- listing_failed with a resume cursor stays failed even with no order rows
INSERT INTO public.booqable_sync_runs (id, scope, state)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'next_7_days',
  'in_progress'
);

SELECT is(
  public.booqable_finish_sync_run(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'cursor-same-page',
    'list failed',
    true
  )->>'state',
  'failed',
  'listing_failed finish is failed with a non-null cursor'
);

SELECT is(
  (SELECT cursor FROM public.booqable_sync_runs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'cursor-same-page',
  'listing_failed finish keeps the current-page cursor'
);

-- Same-order retry updates the row and does not double counts
INSERT INTO public.booqable_sync_runs (id, scope, state)
VALUES (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'next_7_days',
  'in_progress'
);

SELECT is(
  public.booqable_record_sync_result(
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'order-retry',
    true,
    NULL,
    NULL,
    false
  )->>'ok',
  'true',
  'first record of an order succeeds'
);

SELECT is(
  public.booqable_record_sync_result(
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'order-retry',
    false,
    'SOURCE_UNAVAILABLE',
    'retry failure',
    false
  )->>'ok',
  'true',
  'same-order record is an upsert'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.booqable_sync_order_results
    WHERE run_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      AND booqable_order_id = 'order-retry'
  ),
  1,
  'unique (run_id, booqable_order_id) keeps one result row'
);

SELECT is(
  (
    SELECT listed
    FROM public.booqable_sync_runs
    WHERE id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  1,
  'same-page retry does not increment listed twice'
);

SELECT is(
  (
    SELECT ok
    FROM public.booqable_sync_order_results
    WHERE run_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      AND booqable_order_id = 'order-retry'
  ),
  false,
  'conflict updates ok/code/error'
);

SELECT is(
  (
    SELECT succeeded
    FROM public.booqable_sync_runs
    WHERE id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  0,
  'success-then-fail retry decrements succeeded'
);

SELECT is(
  (
    SELECT failed
    FROM public.booqable_sync_runs
    WHERE id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  1,
  'success-then-fail retry increments failed'
);

SELECT is(
  public.booqable_finish_sync_run(
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'cursor-retry-page',
    'retry failure',
    false
  )->>'state',
  'failed',
  'success-then-fail finish stays failed'
);

INSERT INTO public.booqable_sync_runs (id, scope, state)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'next_7_days',
  'in_progress'
);

SELECT is(
  public.booqable_record_sync_result(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'order-recovered',
    false,
    'SOURCE_UNAVAILABLE',
    'first failure',
    false
  )->>'ok',
  'true',
  'fail-then-success first record'
);

SELECT is(
  public.booqable_record_sync_result(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'order-recovered',
    true,
    NULL,
    NULL,
    false
  )->>'ok',
  'true',
  'fail-then-success retry'
);

SELECT is(
  (
    SELECT failed
    FROM public.booqable_sync_runs
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  0,
  'fail-then-success retry clears failed'
);

SELECT is(
  (
    SELECT succeeded
    FROM public.booqable_sync_runs
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  1,
  'fail-then-success retry increments succeeded'
);

SELECT is(
  public.booqable_finish_sync_run(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL,
    NULL,
    false
  )->>'state',
  'succeeded',
  'recovered page can finish as succeeded'
);

-- Reserved apply through the mint_tasks wrapper mints a task
CREATE TEMP TABLE reserved_mint_lease AS
SELECT public.booqable_acquire_order_lease(
  'sync-reserved-mint', now() + interval '2 minutes', 'test'
) AS payload;

SELECT is(
  public.booqable_apply_source_snapshot_v1(
    'sync-reserved-mint',
    ((SELECT payload FROM reserved_mint_lease)->>'token')::uuid,
    ((SELECT payload FROM reserved_mint_lease)->>'fence')::bigint,
    pg_temp.snap('sync-reserved-mint', 'reserved', 'stock-sync-mint', 'sip-sync-mint'),
    true
  )->>'ok',
  'true',
  'reserved apply with mint_tasks true succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_tasks t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.booqable_order_id = 'sync-reserved-mint'
  ),
  1,
  'reserved mint_tasks true wrapper mints a bike_tasks row'
);

-- A captured local candidate may be canceled at source before reconciliation.
CREATE TEMP TABLE stale_source_lease AS
SELECT public.booqable_acquire_order_lease(
  'sync-stale-local', now() + interval '2 minutes', 'test') AS payload;
SELECT is(public.booqable_apply_source_snapshot_v1(
  'sync-stale-local',
  ((SELECT payload FROM stale_source_lease)->>'token')::uuid,
  ((SELECT payload FROM stale_source_lease)->>'fence')::bigint,
  pg_temp.snap('sync-stale-local', 'reserved'), false)->>'ok',
  'true', 'local candidate initially applies as reserved');
SELECT public.booqable_release_order_lease(
  'sync-stale-local',
  ((SELECT payload FROM stale_source_lease)->>'token')::uuid,
  ((SELECT payload FROM stale_source_lease)->>'fence')::bigint);
UPDATE stale_source_lease SET payload = public.booqable_acquire_order_lease(
  'sync-stale-local', now() + interval '2 minutes', 'test');
SELECT is(public.booqable_apply_source_snapshot_v1(
  'sync-stale-local',
  ((SELECT payload FROM stale_source_lease)->>'token')::uuid,
  ((SELECT payload FROM stale_source_lease)->>'fence')::bigint,
  pg_temp.snap('sync-stale-local', 'canceled'), false)->>'ok',
  'true', 'authoritative canceled snapshot reconciles stale local candidate');
SELECT is((SELECT status::text FROM public.orders
  WHERE booqable_order_id = 'sync-stale-local'),
  'canceled', 'canceled candidate leaves Dashboard status scope');

-- Dashboard selected-period policy: server-owned bounds, phases, candidates and retry.
SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(
  public.dashboard_start_selected_sync('2026-10-25', '2026-10-25')->>'ok',
  'true', 'staff starts selected-period refresh'
);
RESET ROLE;

CREATE TEMP TABLE selected_run AS
SELECT id, from_instant, to_instant_exclusive, policy_version
FROM public.booqable_sync_runs WHERE scope = 'selected_period'
ORDER BY created_at DESC LIMIT 1;
GRANT SELECT ON selected_run TO authenticated;

SELECT is((SELECT from_instant::text FROM selected_run),
  '2026-10-24 22:00:00+00', 'Madrid DST start bound is saved');
SELECT is((SELECT to_instant_exclusive::text FROM selected_run),
  '2026-10-25 23:00:00+00', 'Madrid DST end bound is saved');
SELECT is((SELECT policy_version FROM selected_run), 1, 'selected policy is versioned');
SELECT ok((SELECT count(*) FROM private.dashboard_sync_candidates
  WHERE run_id = (SELECT id FROM selected_run)) >= 1,
  'local in-window candidate is captured at start');
-- Isolate the source-list retry fixture from the captured local fixture.
DELETE FROM private.dashboard_sync_candidates
WHERE run_id = (SELECT id FROM selected_run);

SELECT pg_temp.become('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SET ROLE authenticated;
SELECT is(public.dashboard_resume_selected_sync((SELECT id FROM selected_run))->>'code',
  'FORBIDDEN', 'partner cannot resume selected run');
SELECT is(public.dashboard_start_selected_sync('2026-10-25', '2026-10-25')->>'code',
  'FORBIDDEN', 'partner cannot start selected run');
RESET ROLE;
SELECT pg_temp.become('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
SET ROLE authenticated;
SELECT is(public.dashboard_resume_selected_sync((SELECT id FROM selected_run))->>'code',
  'FORBIDDEN', 'pending profile cannot resume selected run');
SELECT is(public.dashboard_start_selected_sync('2026-10-25', '2026-10-25')->>'code',
  'FORBIDDEN', 'pending profile cannot start selected run');
RESET ROLE;
SELECT is(has_function_privilege('anon', 'public.dashboard_start_selected_sync(date,date)', 'EXECUTE'),
  false, 'anonymous role cannot call selected start');
SELECT is(has_function_privilege('anon', 'public.dashboard_resume_selected_sync(uuid)', 'EXECUTE'),
  false, 'anonymous role cannot call selected resume');

SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence,
  'starts_at', 1, ARRAY['source-both', 'source-both'], false)->>'phase',
  'stops_at', 'first listing checkpoint advances to returns'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence,
  'starts_at', 1, ARRAY[]::text[], false)->>'code',
  'SOURCE_UNAVAILABLE', 'stale phase checkpoint is rejected'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence,
  'stops_at', 1, ARRAY['source-both', 'source-return'], false)->>'phase',
  'reconcile', 'return checkpoint completes discovery'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is((SELECT count(*)::integer FROM private.dashboard_sync_candidates
  WHERE run_id = (SELECT id FROM selected_run)
    AND booqable_order_id LIKE 'source-%'), 2,
  'source start and return candidates deduplicate by ID');
SELECT is(public.dashboard_finish_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence, NULL)->>'state',
  'in_progress', 'complete discovery without reconciliation is incomplete'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_record_selected_result(
  (SELECT id FROM selected_run), l.token, l.fence,
  'source-both', true, NULL, NULL)->>'ok',
  'true', 'first required candidate succeeds'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_record_selected_result(
  (SELECT id FROM selected_run), l.token, l.fence,
  'source-return', false, 'SOURCE_UNAVAILABLE', 'deleted at source')->>'ok',
  'true', 'unavailable candidate stays explicit'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_finish_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence, NULL)->>'state',
  'failed', 'a failed candidate prevents coverage success'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT private.booqable_release_run_lease('manual_sync', l.token, l.fence)
FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';

SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.dashboard_resume_selected_sync((SELECT id FROM selected_run))->>'ok',
  'true', 'staff resumes the saved interval after failure');
RESET ROLE;
SELECT is((SELECT attempt FROM public.booqable_sync_runs
  WHERE id = (SELECT id FROM selected_run)), 2, 'failed retry increments attempt');
SELECT is(public.dashboard_selected_sync_work(
  (SELECT id FROM selected_run), l.token, l.fence, 10)->'ids',
  '["source-return"]'::jsonb, 'retry returns only failed candidate'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_record_selected_result(
  (SELECT id FROM selected_run), l.token, l.fence,
  'source-return', true, NULL, NULL)->>'ok',
  'true', 'retry replaces failed candidate outcome'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_finish_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence, NULL)->>'state',
  'succeeded', 'complete discovery and recovered outcomes can succeed'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is((SELECT failed FROM public.booqable_sync_runs
  WHERE id = (SELECT id FROM selected_run)), 0, 'final counters reflect replacement');
SELECT is((SELECT scope FROM public.booqable_sync_runs WHERE id = (SELECT id FROM started_run)),
  'next_7_days', 'legacy run scope remains readable');
SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM selected_run), l.token, l.fence,
  'stops_at', 1, ARRAY[]::text[], false)->>'code',
  'SOURCE_UNAVAILABLE', 'completed run rejects stale checkpoint'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT private.booqable_release_run_lease('manual_sync', l.token, l.fence)
FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';

SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.dashboard_start_selected_sync('2030-10-27', '2030-10-27')->>'ok',
  'true', 'staff can start an empty selected period');
RESET ROLE;
CREATE TEMP TABLE empty_selected_run AS
SELECT id FROM public.booqable_sync_runs WHERE scope = 'selected_period'
  AND id <> (SELECT id FROM selected_run)
ORDER BY created_at DESC, id DESC LIMIT 1;
GRANT SELECT ON empty_selected_run TO authenticated;
SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM empty_selected_run), l.token, l.fence,
  'starts_at', 1, ARRAY[]::text[], false)->>'phase',
  'stops_at', 'empty start listing is complete'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM empty_selected_run), l.token, l.fence,
  'stops_at', 1, ARRAY[]::text[], false)->>'phase',
  'reconcile', 'empty return listing is complete'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_finish_selected_sync(
  (SELECT id FROM empty_selected_run), l.token, l.fence, NULL)->>'state',
  'succeeded', 'fully enumerated empty period can succeed'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT private.booqable_release_run_lease('manual_sync', l.token, l.fence)
FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';

UPDATE public.booqable_sync_runs SET policy_version = NULL, state = 'failed'
WHERE id = (SELECT id FROM empty_selected_run);
SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.dashboard_resume_selected_sync((SELECT id FROM empty_selected_run))->>'code',
  'SOURCE_UNAVAILABLE', 'missing policy version cannot resume or acquire a lease');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM private.booqable_run_leases
  WHERE lock_key = 'manual_sync' AND expires_at > now()), 0, 'invalid metadata did not acquire a lease');
UPDATE public.booqable_sync_runs SET policy_version = 1,
  from_instant = NULL WHERE id = (SELECT id FROM empty_selected_run);
SET ROLE authenticated;
SELECT is(public.dashboard_resume_selected_sync((SELECT id FROM empty_selected_run))->>'code',
  'SOURCE_UNAVAILABLE', 'missing saved bound cannot resume');
RESET ROLE;

SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.dashboard_start_selected_sync('2030-10-28', '2030-10-28')->>'ok',
  'true', 'staff starts another selected refresh for abort test');
RESET ROLE;
CREATE TEMP TABLE abort_selected_lease AS
SELECT run_id, token, fence FROM private.booqable_run_leases
WHERE lock_key = 'manual_sync';
GRANT SELECT ON abort_selected_lease TO authenticated;
SELECT pg_temp.become('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SET ROLE authenticated;
SELECT is(public.dashboard_abort_selected_sync(l.run_id, l.token, l.fence, 'worker failed')->>'code',
  'FORBIDDEN', 'nonstaff user cannot abort an acquired run')
FROM abort_selected_lease l;
RESET ROLE;
SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.dashboard_abort_selected_sync(NULL::uuid, l.token, l.fence, 'worker failed')->>'ok',
  'true', 'lease owner can save failure and release lease when response omitted run ID')
FROM abort_selected_lease l;
RESET ROLE;
SELECT is((SELECT state FROM public.booqable_sync_runs
  WHERE id = (SELECT run_id FROM abort_selected_lease)), 'failed',
  'worker abort is visible as failed saved run');
SELECT is((SELECT last_error FROM public.booqable_sync_runs
  WHERE id = (SELECT run_id FROM abort_selected_lease)), 'worker failed',
  'worker abort saves its reason');
SELECT is((SELECT count(*)::integer FROM private.booqable_run_leases
  WHERE lock_key = 'manual_sync' AND expires_at > now()), 0, 'worker abort releases the lease');
SELECT ok((SELECT scope IN ('next_7_days', 'all_reserved')
  FROM public.workshop_sync_health),
  'Workshop health continues to report a legacy reserved-list run');

-- A pre-update cursor cannot be interpreted as a bounded window. Closing it
-- preserves its recorded result and allows a fresh run on the next click.
INSERT INTO public.booqable_sync_runs (id, scope, state, cursor)
VALUES ('99999999-9999-4999-8999-999999999999', 'next_7_days', 'in_progress', 'legacy-page-4');
SELECT is(private.booqable_record_sync_result(
  '99999999-9999-4999-8999-999999999999', 'legacy-order', true, NULL, NULL, false)->>'ok',
  'true', 'legacy fixture retains a prior order result');
SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.workshop_start_window_sync()->>'code', 'SOURCE_UNAVAILABLE',
  'first start closes incompatible legacy Workshop runs');
RESET ROLE;
SELECT is((SELECT state FROM public.booqable_sync_runs
  WHERE id = '99999999-9999-4999-8999-999999999999'), 'failed',
  'legacy run closes unsuccessfully');
SELECT is((SELECT cursor FROM public.booqable_sync_runs
  WHERE id = '99999999-9999-4999-8999-999999999999'), 'legacy-page-4',
  'legacy cursor remains historical evidence');
SELECT ok((SELECT retired_at IS NOT NULL FROM public.booqable_sync_runs
  WHERE id = '99999999-9999-4999-8999-999999999999'),
  'retirement time is recorded');
SELECT is((SELECT count(*)::integer FROM public.booqable_sync_order_results
  WHERE run_id = '99999999-9999-4999-8999-999999999999'), 1,
  'legacy result history remains intact');

SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
CREATE TEMP TABLE workshop_window_start AS
SELECT public.workshop_start_window_sync() AS result;
SELECT is((SELECT result->>'ok' FROM workshop_window_start), 'true',
  'staff can start the new bounded Workshop run');
RESET ROLE;
CREATE TEMP TABLE workshop_window_run AS
SELECT id, from_date, to_date, from_instant, to_instant_exclusive, policy_version
FROM public.booqable_sync_runs WHERE id =
  (SELECT (result->>'runId')::uuid FROM workshop_window_start);
SELECT is((SELECT policy_version FROM workshop_window_run), 2,
  'Workshop run records current policy version');
SELECT is((SELECT to_date - from_date FROM workshop_window_run), 6,
  'Workshop run freezes seven Madrid dates');
SELECT ok((SELECT from_instant = (from_date::timestamp AT TIME ZONE 'Europe/Madrid')
  AND to_instant_exclusive = ((to_date + 1)::timestamp AT TIME ZONE 'Europe/Madrid')
  FROM workshop_window_run), 'saved Workshop bounds use Madrid midnight');
SELECT ok((SELECT count(*) > 0 FROM private.dashboard_sync_candidates
  WHERE run_id = (SELECT id FROM workshop_window_run)),
  'Workshop captures locally eligible stale candidates before provider listing');
DELETE FROM private.dashboard_sync_candidates
WHERE run_id = (SELECT id FROM workshop_window_run);
SELECT is(public.dashboard_checkpoint_selected_sync(
  (SELECT id FROM workshop_window_run), l.token, l.fence,
  'starts_at', 1, ARRAY['window-order', 'window-order'], false)->>'phase',
  'reconcile', 'Workshop has one discovery pass and deduplicates candidates'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_selected_sync_work(
  (SELECT id FROM workshop_window_run), l.token, l.fence, 10)->'ids',
  '["window-order"]'::jsonb, 'shared worker returns Workshop candidate'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_record_selected_result(
  (SELECT id FROM workshop_window_run), l.token, l.fence,
  'window-order', true, NULL, NULL)->>'ok', 'true',
  'shared worker records Workshop order success'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT is(public.dashboard_finish_selected_sync(
  (SELECT id FROM workshop_window_run), l.token, l.fence, NULL)->>'state',
  'succeeded', 'completed Workshop window is successful'
) FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT private.booqable_release_run_lease('manual_sync', l.token, l.fence)
FROM private.booqable_run_leases l WHERE l.lock_key = 'manual_sync';
SELECT ok((SELECT last_success_at IS NOT NULL FROM public.workshop_sync_health),
  'current exact Workshop window supplies freshness evidence');

INSERT INTO public.booqable_sync_runs (
  id, scope, state, policy_version, from_date, to_date,
  from_instant, to_instant_exclusive, discovery_phase, discovery_page)
SELECT '77777777-7777-4777-8777-777777777777', 'next_7_days', 'failed', 2,
  from_date, to_date, NULL, to_instant_exclusive, 'starts_at', 1
FROM workshop_window_run;
SELECT pg_temp.become('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SET ROLE authenticated;
SELECT is(public.workshop_resume_window_sync(
  '77777777-7777-4777-8777-777777777777')->>'code',
  'SOURCE_UNAVAILABLE', 'malformed saved Workshop run cannot resume');
RESET ROLE;
SELECT ok((SELECT retired_at IS NOT NULL FROM public.booqable_sync_runs
  WHERE id = '77777777-7777-4777-8777-777777777777'),
  'malformed Workshop run is closed for a fresh start');
SELECT is((SELECT count(*)::integer FROM private.booqable_run_leases
  WHERE lock_key = 'manual_sync' AND expires_at > now()), 0,
  'malformed resume releases its lease');

INSERT INTO public.booqable_sync_runs (id, scope, state)
VALUES ('88888888-8888-4888-8888-888888888888', 'next_7_days', 'in_progress');
SELECT is(private.booqable_record_sync_result(
  '88888888-8888-4888-8888-888888888888', 'counter-order', true, NULL, NULL, true)->>'ok',
  'true', 'first skipped result records');
SELECT is(private.booqable_record_sync_result(
  '88888888-8888-4888-8888-888888888888', 'counter-order', false, 'SOURCE_UNAVAILABLE', 'failure', false)->>'ok',
  'true', 'skipped result can become failed');
SELECT is(private.booqable_record_sync_result(
  '88888888-8888-4888-8888-888888888888', 'counter-order', false, 'SOURCE_UNAVAILABLE', 'failure', false)->>'ok',
  'true', 'duplicate failed result is idempotent');
SELECT is((SELECT (listed, succeeded, failed, skipped) FROM public.booqable_sync_runs
  WHERE id = '88888888-8888-4888-8888-888888888888')::text,
  '(1,0,1,0)', 'duplicate keeps exact latest-result counters');
SELECT is(private.booqable_record_sync_result(
  '88888888-8888-4888-8888-888888888888', 'counter-order', true, NULL, NULL, false)->>'ok',
  'true', 'failed result can become successful');
SELECT is((SELECT (listed, succeeded, failed, skipped) FROM public.booqable_sync_runs
  WHERE id = '88888888-8888-4888-8888-888888888888')::text,
  '(1,1,0,0)', 'failure to success keeps exact counters');

SELECT finish();

ROLLBACK;
