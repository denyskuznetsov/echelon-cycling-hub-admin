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

CREATE OR REPLACE FUNCTION pg_temp.make_task(
  p_tag text,
  p_warning boolean,
  p_copy_road boolean,
  p_fingerprint text DEFAULT 'fp-v1'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_instance_id uuid;
  v_task_id uuid;
  v_def_id uuid;
BEGIN
  INSERT INTO public.orders (
    booqable_order_id, order_number, starts_at, addon_fingerprint, source_fingerprint
  ) VALUES (
    'bq-' || gen_random_uuid()::text,
    9001,
    now() + interval '1 day',
    p_fingerprint,
    'src-fp'
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.booqable_assignment_instances (
    order_id, booqable_stock_item_id, bike_display_id, bike_title
  ) VALUES (
    v_order_id, 'stock-' || gen_random_uuid()::text, 'RD-101', 'Road Bike'
  )
  RETURNING id INTO v_instance_id;

  INSERT INTO public.bike_tasks (
    assignment_instance_id, task_kind, status, version,
    order_id, order_number, starts_at,
    booqable_stock_item_id, bike_display_id, bike_title,
    workshop_tag, has_configuration_warning
  )
  SELECT
    v_instance_id,
    'rental_turnaround',
    'to_prepare',
    1,
    v_order_id,
    9001,
    now() + interval '1 day',
    i.booqable_stock_item_id,
    i.bike_display_id,
    i.bike_title,
    p_tag,
    p_warning
  FROM public.booqable_assignment_instances i
  WHERE i.id = v_instance_id
  RETURNING id INTO v_task_id;

  IF p_copy_road THEN
    SELECT m.definition_id INTO v_def_id
    FROM public.checklist_tag_mappings m
    WHERE m.tag = p_tag;
    IF v_def_id IS NOT NULL THEN
      UPDATE public.bike_tasks
      SET selected_definition_id = v_def_id
      WHERE id = v_task_id;
      PERFORM private.workshop_copy_definition_items(
        v_task_id, v_def_id, 'preparation'::public.bike_task_item_stage
      );
    END IF;
  END IF;

  RETURN v_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.make_stale_road_task()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_old uuid;
BEGIN
  SELECT d.id INTO v_old
  FROM public.checklist_definitions d
  WHERE d.definition_key = 'road_bike_preparation' AND d.version = 2;

  v_task_id := pg_temp.make_task('workshop-road-bike', false, true);
  PERFORM private.workshop_replace_preparation_items(v_task_id, v_old);
  UPDATE public.bike_tasks
  SET selected_definition_id = v_old
  WHERE id = v_task_id;
  RETURN v_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fill_m1(p_task_id uuid, p_na_keys text[] DEFAULT '{}')
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
  v_version integer;
  v_result jsonb;
BEGIN
  SELECT t.version INTO STRICT v_version FROM public.bike_tasks t WHERE t.id = p_task_id;
  FOR v_item IN
    SELECT i.id, i.item_type, i.item_key
    FROM public.bike_task_items i
    WHERE i.task_id = p_task_id AND i.stage = 'preparation'
    ORDER BY i.sort_order
  LOOP
    IF v_item.item_key = ANY (p_na_keys) THEN
      v_result := public.workshop_set_item_outcome(
        p_task_id, v_version, v_item.id, 'not_applicable', NULL
      );
    ELSIF v_item.item_type = 'tyre_pressure_psi' THEN
      v_result := public.workshop_set_item_outcome(
        p_task_id, v_version, v_item.id, 'completed', 80
      );
    ELSE
      v_result := public.workshop_set_item_outcome(
        p_task_id, v_version, v_item.id, 'completed', NULL
      );
    END IF;
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'fill_m1 failed: %', v_result;
    END IF;
    v_version := (v_result->>'version')::integer;
  END LOOP;
  RETURN v_version;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fill_m2(p_task_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
  v_version integer;
  v_result jsonb;
BEGIN
  SELECT t.version INTO STRICT v_version FROM public.bike_tasks t WHERE t.id = p_task_id;
  FOR v_item IN
    SELECT i.id
    FROM public.bike_task_items i
    WHERE i.task_id = p_task_id
      AND i.stage = 'preparation'
      AND i.m2_verifies
      AND i.m1_outcome IS DISTINCT FROM 'not_applicable'
    ORDER BY i.sort_order
  LOOP
    v_result := public.workshop_confirm_m2_item(p_task_id, v_version, v_item.id);
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'fill_m2 failed: %', v_result;
    END IF;
    v_version := (v_result->>'version')::integer;
  END LOOP;
  RETURN v_version;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fill_storage(p_task_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
  v_version integer;
  v_result jsonb;
BEGIN
  SELECT t.version INTO STRICT v_version FROM public.bike_tasks t WHERE t.id = p_task_id;
  FOR v_item IN
    SELECT i.id, i.item_key
    FROM public.bike_task_items i
    WHERE i.task_id = p_task_id AND i.stage = 'storage'
    ORDER BY i.sort_order
  LOOP
    IF v_item.item_key = 'STORAGE-02' THEN
      v_result := public.workshop_set_item_outcome(
        p_task_id, v_version, v_item.id, 'not_applicable', NULL
      );
    ELSE
      v_result := public.workshop_set_item_outcome(
        p_task_id, v_version, v_item.id, 'completed', NULL
      );
    END IF;
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'fill_storage failed: %', v_result;
    END IF;
    v_version := (v_result->>'version')::integer;
  END LOOP;
  RETURN v_version;
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.fill_m1(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.fill_m2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.fill_storage(uuid) TO authenticated;

-- Seeds (mapped active catalogs)
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
  ),
  20,
  'mapped ROAD seed has 20 items'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
  ),
  6,
  'STORAGE seed has 6 items'
);

SELECT is(
  ARRAY(
    SELECT i.item_key
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'ROAD-01','ROAD-02','ROAD-03','ROAD-04','ROAD-05',
    'ROAD-06','ROAD-07','ROAD-08','ROAD-09','ROAD-10',
    'ROAD-11','ROAD-12','ROAD-13','ROAD-14','ROAD-15',
    'ROAD-16','ROAD-17','ROAD-18','ROAD-19','ROAD-20'
  ],
  'ROAD item keys match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.label
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'Bikefit applied',
    'Bike cleaned',
    'Check frame and components for damage',
    'Rewax chain',
    'Check brake pads wear, pins checked',
    'Check rotors wear',
    'Adjust brakes',
    'Adjust gears',
    'Tighten pedals and cranks',
    'Check front tyre wear, pressure PSI',
    'Check rear tyre wear, pressure PSI',
    'Adjust headset preload',
    'Check saddle level',
    'Bolt check — stem, handlebar, saddle',
    'Bag/pump/comp mount',
    'Charger/lube with a bike',
    'Charge + check shifting batteries',
    'Check powermeter battery',
    'Customer name on a bike',
    'Attach a haribo pouch to the bike'
  ],
  'ROAD labels match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.item_type::text
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'action','action','action','action','action',
    'action','action','action','action','tyre_pressure_psi',
    'tyre_pressure_psi','action','action','action','action',
    'action','action','action','action','action'
  ],
  'ROAD item types match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.required
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    true,true,true,true,true,
    true,true,true,true,true,
    true,true,true,true,true,
    true,true,true,true,true
  ],
  'ROAD required flags are all true'
);

SELECT is(
  ARRAY(
    SELECT i.m2_verifies
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    false,false,false,false,false,
    false,true,true,false,true,
    true,false,false,true,true,
    true,true,false,false,false
  ],
  'ROAD m2_verifies flags match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.na_allowed
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-road-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    true,false,false,true,false,
    false,false,false,false,false,
    false,false,false,false,false,
    true,false,true,false,true
  ],
  'ROAD na_allowed flags match launch-checklists.md'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
  ),
  23,
  'mapped e-city seed has 23 items'
);

SELECT is(
  ARRAY(
    SELECT i.item_key
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'ECITY-01','ECITY-02','ECITY-03','ECITY-04','ECITY-05',
    'ECITY-06','ECITY-07','ECITY-08','ECITY-09','ECITY-10',
    'ECITY-11','ECITY-12','ECITY-13','ECITY-14','ECITY-15',
    'ECITY-16','ECITY-17','ECITY-18','ECITY-19','ECITY-20',
    'ECITY-21','ECITY-22','ECITY-23'
  ],
  'e-city item keys match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.label
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'Check bike, bag cleaned',
    'Check frame and components for damage',
    'Check front brake performance',
    'Check rear brake performance',
    'Check rear derailleur shifting',
    'Torque check: stem and handlebar',
    'Torque check: seatpost and saddle clamp',
    'Torque check: front and rear thru-axle',
    'Check headset for play',
    'Check front wheel is true',
    'Check front tyre for wear, cuts, and cracks',
    'Check rear wheel is true',
    'Check rear tyre for wear, cuts, and cracks',
    'Set front tyre pressure PSI',
    'Set rear tyre pressure PSI',
    'Check main battery level (>80%)',
    'Check saddle bag contents, pump',
    'Verify charger and lock included',
    'Verify keys matched and included',
    'Customer name tag attached',
    'Check saddle level',
    'Bikefit applied',
    'Attach a haribo pouch to the bike'
  ],
  'e-city labels match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.item_type::text
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'action','action','action','action','action',
    'action','action','action','action','action',
    'action','action','action','tyre_pressure_psi','tyre_pressure_psi',
    'action','action','action','action','action',
    'action','action','action'
  ],
  'e-city item types match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.required
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    true,true,true,true,true,
    true,true,true,true,true,
    true,true,true,true,true,
    true,true,true,true,true,
    true,true,true
  ],
  'e-city required flags are all true'
);

SELECT is(
  ARRAY(
    SELECT i.m2_verifies
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    false,false,true,true,true,
    true,true,true,true,false,
    true,false,true,true,true,
    true,true,true,true,false,
    false,false,false
  ],
  'e-city m2_verifies flags match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.na_allowed
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    false,false,false,false,false,
    false,false,false,false,false,
    false,false,false,false,false,
    false,false,false,false,false,
    false,true,true
  ],
  'e-city na_allowed flags match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.item_key
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
    ORDER BY i.sort_order
  ),
  ARRAY['STORAGE-01','STORAGE-02','STORAGE-03','STORAGE-04','STORAGE-05','STORAGE-06'],
  'STORAGE item keys match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.label
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
    ORDER BY i.sort_order
  ),
  ARRAY[
    'Check bike for damage',
    'Check saddle bag contents',
    'Check charger',
    'Restore customized parts and settings to the bike''s default setup',
    'Clean the bike',
    'Return the bike to storage'
  ],
  'STORAGE labels match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.item_type::text
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
    ORDER BY i.sort_order
  ),
  ARRAY['action','action','action','action','action','action'],
  'STORAGE item types are all action'
);

SELECT is(
  ARRAY(
    SELECT i.required
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
    ORDER BY i.sort_order
  ),
  ARRAY[true,true,true,true,true,true],
  'STORAGE required flags are all true'
);

SELECT is(
  ARRAY(
    SELECT i.m2_verifies
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
    ORDER BY i.sort_order
  ),
  ARRAY[false,false,false,false,false,false],
  'STORAGE m2_verifies flags are all false'
);

SELECT is(
  ARRAY(
    SELECT i.na_allowed
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage' AND d.version = 1
    ORDER BY i.sort_order
  ),
  ARRAY[false,true,true,true,false,false],
  'STORAGE na_allowed flags match launch-checklists.md'
);

SELECT is(
  (SELECT enabled FROM public.checklist_tag_mappings WHERE tag = 'workshop-road-bike'),
  true,
  'road mapping is enabled'
);

SELECT is(
  (
    SELECT d.definition_key
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-road-bike'
  ),
  'road_bike_preparation',
  'road mapping uses road_bike_preparation'
);

SELECT is(
  (
    SELECT d.version
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-road-bike'
  ),
  3,
  'road mapping points at version 3'
);

SELECT is(
  (SELECT enabled FROM public.checklist_tag_mappings WHERE tag = 'workshop-e-city-bike'),
  true,
  'e-city mapping is enabled'
);

SELECT is(
  (
    SELECT d.definition_key
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
  ),
  'e_city_bike_preparation',
  'e-city mapping uses e_city_bike_preparation'
);

SELECT is(
  (
    SELECT d.version
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-e-city-bike'
  ),
  2,
  'e-city mapping points at version 2'
);

SELECT is(
  (SELECT enabled FROM public.checklist_tag_mappings WHERE tag = 'workshop-gravel-bike'),
  true,
  'gravel mapping is enabled'
);

SELECT is(
  (
    SELECT d.definition_key
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-gravel-bike'
  ),
  'gravel_bike_preparation',
  'gravel mapping uses gravel_bike_preparation'
);

SELECT is(
  (
    SELECT d.version
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-gravel-bike'
  ),
  1,
  'gravel mapping points at version 1'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-gravel-bike'
  ),
  20,
  'mapped gravel seed has 20 items'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
      WHERE m.tag = 'workshop-gravel-bike'
      EXCEPT
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_definitions d ON d.id = i.definition_id
      WHERE d.definition_key = 'road_bike_preparation' AND d.version = 3
    ) extra
  ),
  0,
  'gravel rows are a subset of road_bike_preparation v3'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_definitions d ON d.id = i.definition_id
      WHERE d.definition_key = 'road_bike_preparation' AND d.version = 3
      EXCEPT
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
      WHERE m.tag = 'workshop-gravel-bike'
    ) missing
  ),
  0,
  'road_bike_preparation v3 rows are a subset of gravel'
);

SELECT is(
  (
    SELECT i.label
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-gravel-bike'
    ORDER BY i.sort_order DESC
    LIMIT 1
  ),
  'Attach a haribo pouch to the bike',
  'mapped gravel last item is Haribo'
);

SELECT is(
  (SELECT enabled FROM public.checklist_tag_mappings WHERE tag = 'workshop-e-road-bike'),
  true,
  'e-road mapping is enabled'
);

SELECT is(
  (
    SELECT d.definition_key
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-e-road-bike'
  ),
  'e_road_bike_preparation',
  'e-road mapping uses e_road_bike_preparation'
);

SELECT is(
  (
    SELECT d.version
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-e-road-bike'
  ),
  1,
  'e-road mapping points at version 1'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-road-bike'
  ),
  20,
  'mapped e-road seed has 20 items'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
      WHERE m.tag = 'workshop-e-road-bike'
      EXCEPT
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_definitions d ON d.id = i.definition_id
      WHERE d.definition_key = 'road_bike_preparation' AND d.version = 3
    ) extra
  ),
  0,
  'e-road rows are a subset of road_bike_preparation v3'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_definitions d ON d.id = i.definition_id
      WHERE d.definition_key = 'road_bike_preparation' AND d.version = 3
      EXCEPT
      SELECT i.item_key, i.sort_order, i.label, i.item_type, i.required, i.m2_verifies, i.na_allowed
      FROM public.checklist_definition_items i
      JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
      WHERE m.tag = 'workshop-e-road-bike'
    ) missing
  ),
  0,
  'road_bike_preparation v3 rows are a subset of e-road'
);

SELECT is(
  (
    SELECT i.label
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-e-road-bike'
    ORDER BY i.sort_order DESC
    LIMIT 1
  ),
  'Attach a haribo pouch to the bike',
  'mapped e-road last item is Haribo'
);

SELECT is(
  (SELECT enabled FROM public.checklist_tag_mappings WHERE tag = 'workshop-partner-bike'),
  true,
  'partner mapping is enabled'
);

SELECT is(
  (
    SELECT d.definition_key
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-partner-bike'
  ),
  'partner_bike_preparation',
  'partner mapping uses partner_bike_preparation'
);

SELECT is(
  (
    SELECT d.version
    FROM public.checklist_tag_mappings m
    JOIN public.checklist_definitions d ON d.id = m.definition_id
    WHERE m.tag = 'workshop-partner-bike'
  ),
  1,
  'partner mapping points at version 1'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
  ),
  6,
  'mapped partner seed has 6 items'
);

SELECT is(
  ARRAY(
    SELECT i.item_key
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'PARTNER-01','PARTNER-02','PARTNER-03',
    'PARTNER-04','PARTNER-05','PARTNER-06'
  ],
  'partner item keys match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.label
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'Check saddle bag, charger',
    'Tyre pressure front',
    'Tyre pressure back',
    'Attach haribo pouch',
    'Bolt check stem, saddle, handlebar',
    'Check computer mount'
  ],
  'partner labels match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.item_type::text
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[
    'action','tyre_pressure_psi','tyre_pressure_psi',
    'action','action','action'
  ],
  'partner item types match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.required
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[true,true,true,true,true,true],
  'partner required flags are all true'
);

SELECT is(
  ARRAY(
    SELECT i.m2_verifies
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[true,true,true,false,true,true],
  'partner m2_verifies flags match launch-checklists.md'
);

SELECT is(
  ARRAY(
    SELECT i.na_allowed
    FROM public.checklist_definition_items i
    JOIN public.checklist_tag_mappings m ON m.definition_id = i.definition_id
    WHERE m.tag = 'workshop-partner-bike'
    ORDER BY i.sort_order
  ),
  ARRAY[true,true,true,true,true,true],
  'partner na_allowed flags match launch-checklists.md'
);

SELECT is(
  (
    SELECT count(DISTINCT m.definition_id)::integer
    FROM public.checklist_tag_mappings m
    WHERE m.tag IN (
      'workshop-road-bike',
      'workshop-e-city-bike',
      'workshop-gravel-bike',
      'workshop-e-road-bike',
      'workshop-partner-bike'
    )
  ),
  5,
  'five enabled mappings use distinct definition ids'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.checklist_definition_items i
    JOIN public.checklist_definitions d ON d.id = i.definition_id
    WHERE d.definition_key = 'prepare_for_storage'
      AND i.label = 'Attach a haribo pouch to the bike'
  ),
  0,
  'storage catalog has no Haribo item'
);

SELECT is(
  (SELECT enabled FROM public.checklist_tag_mappings WHERE tag = 'workshop-e-mtb-bike'),
  false,
  'e-mtb mapping stays disabled'
);

SELECT is(
  (SELECT definition_id FROM public.checklist_tag_mappings WHERE tag = 'workshop-e-mtb-bike'),
  NULL,
  'e-mtb mapping has no definition'
);

SELECT is(
  ARRAY(
    SELECT tag
    FROM public.checklist_tag_mappings
    WHERE enabled = false
    ORDER BY tag
  ),
  ARRAY['workshop-e-mtb-bike'],
  'only e-mtb stays disabled'
);

-- Users
SELECT pg_temp.create_staff(
  '11111111-1111-4111-8111-111111111111',
  'ws-mechanic-1@test.local',
  'Ada',
  'Mechanic',
  'mechanic'
);
SELECT pg_temp.create_staff(
  '22222222-2222-4222-8222-222222222222',
  'ws-mechanic-2@test.local',
  'Bob',
  'Recheck',
  'mechanic'
);
SELECT pg_temp.create_staff(
  '33333333-3333-4333-8333-333333333333',
  'ws-mechanic-unnamed@test.local',
  NULL,
  NULL,
  'mechanic'
);
SELECT pg_temp.create_staff(
  '44444444-4444-4444-8444-444444444444',
  'ws-partner@test.local',
  'Pat',
  'Partner',
  'partner'
);

CREATE TEMP TABLE ws_ids (
  mechanic uuid,
  mechanic2 uuid,
  unnamed uuid,
  partner uuid,
  road_task uuid,
  blocked_task uuid
);

INSERT INTO ws_ids VALUES (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  pg_temp.make_task('workshop-road-bike', false, true, 'fp-v1'),
  pg_temp.make_task(NULL, true, false, 'fp-v1')
);

CREATE TEMP TABLE ws_config_tasks AS
SELECT * FROM (
  VALUES
    ('unknown', pg_temp.make_task('not-a-workshop-tag', true, false)),
    ('multiple', pg_temp.make_task(NULL, true, false)),
    ('e-city', pg_temp.make_task('workshop-e-city-bike', false, true)),
    ('e-mtb', pg_temp.make_task('workshop-e-mtb-bike', true, false)),
    ('gravel', pg_temp.make_task('workshop-gravel-bike', false, true)),
    ('e-road', pg_temp.make_task('workshop-e-road-bike', false, true)),
    ('partner', pg_temp.make_task('workshop-partner-bike', false, true)),
    ('stale-road', pg_temp.make_stale_road_task()),
    ('warn-gravel', pg_temp.make_task('workshop-gravel-bike', true, false))
) AS t(kind, id);

GRANT SELECT ON ws_ids TO authenticated;
GRANT SELECT ON ws_config_tasks TO authenticated;

-- Start prep, mapped road
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT is(
  public.workshop_start_preparation((SELECT road_task FROM ws_ids), 1) ->> 'status',
  'being_prepared',
  'mapped road start prep → being_prepared'
);
SELECT is(
  (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids)),
  2,
  'mapped road start prep increments version'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.workshop_tasks_view v
    WHERE v.task_id = (SELECT road_task FROM ws_ids)
  ),
  'mechanic can SELECT fixture rows from workshop_tasks_view'
);

-- Start prep, no tag
SELECT is(
  public.workshop_start_preparation((SELECT blocked_task FROM ws_ids), 1) ->> 'code',
  'CONFIGURATION_BLOCKED',
  'no tag start prep → CONFIGURATION_BLOCKED'
);
SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t WHERE t.id = (SELECT blocked_task FROM ws_ids)),
  'to_prepare',
  'no tag start prep does not transition'
);

-- Unrecognized / multiple / disabled tags
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'unknown'), 1) ->> 'code',
  'CONFIGURATION_BLOCKED',
  'unrecognized tag → CONFIGURATION_BLOCKED'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'multiple'), 1) ->> 'code',
  'CONFIGURATION_BLOCKED',
  'multiple-tag warning fixture → CONFIGURATION_BLOCKED'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'e-city'), 1) ->> 'status',
  'being_prepared',
  'mapped e-city start prep → being_prepared'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'e-mtb'), 1) ->> 'code',
  'CONFIGURATION_BLOCKED',
  'disabled e-mtb tag is not startable'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'gravel'), 1) ->> 'status',
  'being_prepared',
  'mapped gravel start prep → being_prepared'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'e-road'), 1) ->> 'status',
  'being_prepared',
  'mapped e-road start prep → being_prepared'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'partner'), 1) ->> 'status',
  'being_prepared',
  'mapped partner start prep → being_prepared'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_config_tasks WHERE kind = 'partner')
      AND i.stage = 'preparation'
  ),
  6,
  'partner start prep keeps 6 copied items'
);
SELECT pg_temp.fill_m1(
  (SELECT id FROM ws_config_tasks WHERE kind = 'partner'),
  ARRAY['PARTNER-02','PARTNER-03']::text[]
);
SELECT is(
  public.workshop_complete_m1(
    (SELECT id FROM ws_config_tasks WHERE kind = 'partner'),
    (SELECT t.version FROM public.bike_tasks t
      WHERE t.id = (SELECT id FROM ws_config_tasks WHERE kind = 'partner'))
  ) ->> 'status',
  'needs_recheck',
  'partner M1 with PARTNER-02/03 N/A → needs_recheck'
);
SELECT pg_temp.fill_m2((SELECT id FROM ws_config_tasks WHERE kind = 'partner'));
SELECT is(
  public.workshop_complete_m2(
    (SELECT id FROM ws_config_tasks WHERE kind = 'partner'),
    (SELECT t.version FROM public.bike_tasks t
      WHERE t.id = (SELECT id FROM ws_config_tasks WHERE kind = 'partner')),
    'fp-v1',
    true
  ) ->> 'status',
  'ready_for_pickup',
  'partner complete M2 without confirming PARTNER-02/03 N/A → ready_for_pickup'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_config_tasks WHERE kind = 'partner')
      AND i.item_key IN ('PARTNER-02', 'PARTNER-03')
      AND i.m1_outcome = 'not_applicable'
      AND COALESCE(i.m2_confirmed, false) IS NOT TRUE
  ),
  2,
  'partner PSI N/A rows stay unconfirmed after complete M2'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'stale-road'), 1) ->> 'status',
  'being_prepared',
  'stale road catalog start prep realigns and starts'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_config_tasks WHERE kind = 'stale-road')
      AND i.stage = 'preparation'
  ),
  20,
  'stale road start recopies current ROAD catalog'
);
SELECT is(
  (
    SELECT i.label
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_config_tasks WHERE kind = 'stale-road')
      AND i.item_key = 'ROAD-20'
  ),
  'Attach a haribo pouch to the bike',
  'stale road start picks up Haribo item'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_config_tasks WHERE kind = 'warn-gravel'), 1) ->> 'status',
  'being_prepared',
  'gravel warning-only start prep copies catalog and starts'
);
SELECT is(
  (
    SELECT t.has_configuration_warning
    FROM public.bike_tasks t
    WHERE t.id = (SELECT id FROM ws_config_tasks WHERE kind = 'warn-gravel')
  ),
  false,
  'gravel warning-only start prep clears configuration warning'
);

-- Incomplete M1
SELECT is(
  public.workshop_complete_m1((SELECT road_task FROM ws_ids), 2) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'complete M1 without items → INCOMPLETE_CHECKLIST'
);
RESET ROLE;

-- Missing profile names
CREATE TEMP TABLE ws_unnamed_task AS
  SELECT pg_temp.make_task('workshop-road-bike', false, true) AS id;
GRANT SELECT ON ws_unnamed_task TO authenticated;
SELECT pg_temp.become((SELECT unnamed FROM ws_ids));
SET ROLE authenticated;
SELECT ok(
  (public.workshop_start_preparation((SELECT id FROM ws_unnamed_task), 1) ->> 'ok')::boolean,
  'unnamed mechanic can start preparation'
);
SELECT pg_temp.fill_m1((SELECT id FROM ws_unnamed_task));
SELECT is(
  public.workshop_complete_m1(
    (SELECT id FROM ws_unnamed_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_unnamed_task))
  ) ->> 'code',
  'PROFILE_NAME_REQUIRED',
  'complete M1 without names → PROFILE_NAME_REQUIRED'
);
RESET ROLE;

-- Complete M1 success
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT pg_temp.fill_m1((SELECT road_task FROM ws_ids));
SELECT is(
  public.workshop_complete_m1(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids))
  ) ->> 'status',
  'needs_recheck',
  'complete M1 → needs_recheck'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_attestations a
    WHERE a.task_id = (SELECT road_task FROM ws_ids) AND a.stage = 'm1'
  ),
  1,
  'M1 attestation is stored'
);
SELECT isnt(
  public.workshop_task_detail((SELECT road_task FROM ws_ids)),
  NULL,
  'mechanic workshop_task_detail is non-null after M1'
);
SELECT ok(
  COALESCE(jsonb_array_length(public.workshop_task_detail((SELECT road_task FROM ws_ids))->'items'), 0) >= 19,
  'detail includes preparation items'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.workshop_task_detail((SELECT road_task FROM ws_ids))->'attestations'
    ) a
    WHERE a->>'stage' = 'm1'
  ),
  'detail includes the M1 attestation'
);

-- M2 incomplete before designated confirms
SELECT is(
  public.workshop_complete_m2(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids)),
    'fp-v1',
    true
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'complete M2 before designated confirms → INCOMPLETE_CHECKLIST'
);

-- Same-person M2 without confirm
SELECT pg_temp.fill_m2((SELECT road_task FROM ws_ids));
SELECT is(
  public.workshop_complete_m2(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids)),
    'fp-v1',
    false
  ) ->> 'code',
  'FORBIDDEN',
  'same-person M2 without confirm → FORBIDDEN'
);

-- ADD_ONS_CHANGED
SELECT is(
  public.workshop_complete_m2(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids)),
    'fp-other',
    true
  ) ->> 'code',
  'ADD_ONS_CHANGED',
  'M2 fingerprint mismatch → ADD_ONS_CHANGED'
);

-- Complete M2 with same-person confirm
SELECT is(
  public.workshop_complete_m2(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids)),
    'fp-v1',
    true
  ) ->> 'status',
  'ready_for_pickup',
  'complete M2 with same-person confirm → ready_for_pickup'
);
SELECT ok(
  (
    SELECT a.same_person_confirmed
    FROM public.bike_task_attestations a
    WHERE a.task_id = (SELECT road_task FROM ws_ids) AND a.stage = 'm2'
  ),
  'M2 attestation stores same-person flag and fingerprint'
);
SELECT is(
  (
    SELECT a.addon_fingerprint
    FROM public.bike_task_attestations a
    WHERE a.task_id = (SELECT road_task FROM ws_ids) AND a.stage = 'm2'
  ),
  'fp-v1',
  'M2 attestation stores addon fingerprint'
);

-- Pickup / return / storage
SELECT is(
  public.workshop_mark_picked_up(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids))
  ) ->> 'status',
  'in_rental',
  'pickup → in_rental'
);
SELECT is(
  public.workshop_mark_returned(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids))
  ) ->> 'status',
  'returned',
  'return → returned'
);
SELECT is(
  public.workshop_start_storage(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids))
  ) ->> 'status',
  'prepare_for_storage',
  'start storage → prepare_for_storage'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT road_task FROM ws_ids) AND i.stage = 'storage'
  ),
  6,
  'start storage copies STORAGE-01..06'
);
SELECT is(
  public.workshop_complete_storage(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids))
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'complete storage without items → INCOMPLETE_CHECKLIST'
);
SELECT pg_temp.fill_storage((SELECT road_task FROM ws_ids));
SELECT is(
  (
    SELECT i.m1_outcome::text
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT road_task FROM ws_ids) AND i.item_key = 'STORAGE-02'
  ),
  'not_applicable',
  'storage N/A is recorded on STORAGE-02'
);
SELECT is(
  public.workshop_complete_storage(
    (SELECT road_task FROM ws_ids),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT road_task FROM ws_ids))
  ) ->> 'status',
  'completed',
  'complete storage with STORAGE-02 N/A → completed'
);
RESET ROLE;

-- Different-person M2 without confirm (second road task)
CREATE TEMP TABLE ws_m2_task AS
  SELECT pg_temp.make_task('workshop-road-bike', false, true, 'fp-v1') AS id;
GRANT SELECT ON ws_m2_task TO authenticated;
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT public.workshop_start_preparation((SELECT id FROM ws_m2_task), 1);
SELECT pg_temp.fill_m1((SELECT id FROM ws_m2_task));
SELECT public.workshop_complete_m1(
  (SELECT id FROM ws_m2_task),
  (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_m2_task))
);
RESET ROLE;
SELECT pg_temp.become((SELECT mechanic2 FROM ws_ids));
SET ROLE authenticated;
SELECT pg_temp.fill_m2((SELECT id FROM ws_m2_task));
SELECT is(
  public.workshop_complete_m2(
    (SELECT id FROM ws_m2_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_m2_task)),
    'fp-v1',
    false
  ) ->> 'status',
  'ready_for_pickup',
  'different-person M2 without confirm → ready_for_pickup'
);
RESET ROLE;

-- Item outcome guards (PSI, disallowed N/A, allowed N/A skipped by M2)
CREATE TEMP TABLE ws_item_task AS
  SELECT pg_temp.make_task('workshop-road-bike', false, true, 'fp-v1') AS id;
GRANT SELECT ON ws_item_task TO authenticated;
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT public.workshop_start_preparation((SELECT id FROM ws_item_task), 1);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_item_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
    (SELECT i.id FROM public.bike_task_items i WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-10'),
    'completed',
    NULL
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'completed PSI with null value → INCOMPLETE_CHECKLIST'
);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_item_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
    (SELECT i.id FROM public.bike_task_items i WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-10'),
    'completed',
    0
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'completed PSI with 0 → INCOMPLETE_CHECKLIST'
);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_item_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
    (SELECT i.id FROM public.bike_task_items i WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-10'),
    'completed',
    -1
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'completed PSI with negative value → INCOMPLETE_CHECKLIST'
);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_item_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
    (SELECT i.id FROM public.bike_task_items i WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-02'),
    'not_applicable',
    NULL
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'N/A on item with na_allowed false → INCOMPLETE_CHECKLIST'
);
SELECT ok(
  (
    public.workshop_set_item_outcome(
      (SELECT id FROM ws_item_task),
      (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
      (SELECT i.id FROM public.bike_task_items i WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-20'),
      'not_applicable',
      NULL
    )->>'ok'
  )::boolean,
  'N/A on ROAD-20 Haribo → ok'
);
SELECT pg_temp.fill_m1((SELECT id FROM ws_item_task), ARRAY['ROAD-16','ROAD-20']::text[]);
SELECT public.workshop_complete_m1(
  (SELECT id FROM ws_item_task),
  (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task))
);
SELECT is(
  public.workshop_complete_m2(
    (SELECT id FROM ws_item_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
    'fp-v1',
    true
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'complete M2 with ROAD-16 N/A but other M2 items unconfirmed → INCOMPLETE_CHECKLIST'
);
SELECT pg_temp.fill_m2((SELECT id FROM ws_item_task));
SELECT is(
  public.workshop_complete_m2(
    (SELECT id FROM ws_item_task),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_item_task)),
    'fp-v1',
    true
  ) ->> 'status',
  'ready_for_pickup',
  'complete M2 without confirming ROAD-16 N/A → ready_for_pickup'
);
SELECT is(
  (
    SELECT i.m1_outcome::text
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-16'
  ),
  'not_applicable',
  'ROAD-16 stays not_applicable after complete M2'
);
SELECT is(
  (
    SELECT i.m2_confirmed
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-16'
  ),
  false,
  'ROAD-16 stays unconfirmed after complete M2'
);
SELECT is(
  (
    SELECT i.m1_outcome::text
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-20'
  ),
  'not_applicable',
  'ROAD-20 Haribo stays not_applicable after complete M2'
);
SELECT is(
  (
    SELECT i.m2_verifies
    FROM public.bike_task_items i
    WHERE i.task_id = (SELECT id FROM ws_item_task) AND i.item_key = 'ROAD-20'
  ),
  false,
  'ROAD-20 Haribo is not an M2 item'
);
RESET ROLE;

-- Active checklist answers can be cleared; submitted stages stay immutable.
CREATE TEMP TABLE ws_uncheck_task AS
  SELECT pg_temp.make_task('workshop-road-bike', false, true, 'fp-v1') AS id;
GRANT SELECT ON ws_uncheck_task TO authenticated;
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT public.workshop_start_preparation((SELECT id FROM ws_uncheck_task), 1);

SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-02'),
  'completed',
  NULL
);
SELECT ok(
  (public.workshop_set_item_outcome(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-02'),
    NULL,
    NULL
  )->>'ok')::boolean,
  'selected action can be cleared'
);
SELECT is(
  (SELECT m1_outcome::text FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-02'),
  NULL,
  'cleared action persists as incomplete'
);

SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-16'),
  'not_applicable',
  NULL
);
SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-16'),
  NULL,
  NULL
);
SELECT is(
  (SELECT m1_outcome::text FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-16'),
  NULL,
  'selected N/A can be cleared'
);

SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-10'),
  'completed',
  80
);
SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-10'),
  NULL,
  NULL
);
SELECT is(
  (SELECT m1_outcome::text FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-10'),
  NULL,
  'saved PSI outcome can be cleared'
);
SELECT is(
  (SELECT m1_psi FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-10'),
  NULL,
  'clearing PSI removes its saved value'
);
SELECT is(
  public.workshop_complete_m1(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'cleared required M1 answer blocks completion'
);

SELECT pg_temp.fill_m1((SELECT id FROM ws_uncheck_task));
SELECT public.workshop_complete_m1(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-02'),
    NULL,
    NULL
  ) ->> 'code',
  'INVALID_TRANSITION',
  'submitted M1 rejects clearing an old item command'
);
SELECT is(
  (SELECT m1_outcome::text FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-02'),
  'completed',
  'rejected post-M1 clear leaves the answer unchanged'
);

SELECT pg_temp.fill_m2((SELECT id FROM ws_uncheck_task));
SELECT is(
  public.workshop_confirm_m2_item(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-07'),
    NULL::boolean
  ) ->> 'code',
  'INVALID_TRANSITION',
  'M2 confirmation requires an explicit checked state'
);
SELECT ok(
  (public.workshop_confirm_m2_item(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-07'),
    false
  )->>'ok')::boolean,
  'confirmed M2 item can be unchecked'
);
SELECT is(
  public.workshop_complete_m2(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    'fp-v1',
    true
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'unchecked required M2 confirmation blocks completion'
);
SELECT public.workshop_confirm_m2_item(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-07'),
  true
);
SELECT public.workshop_complete_m2(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  'fp-v1',
  true
);
SELECT is(
  public.workshop_confirm_m2_item(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-07'),
    false
  ) ->> 'code',
  'INVALID_TRANSITION',
  'submitted M2 rejects unchecking an old confirmation command'
);
SELECT is(
  (SELECT m2_confirmed FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'ROAD-07'),
  true,
  'rejected post-M2 uncheck leaves confirmation unchanged'
);

SELECT public.workshop_mark_picked_up(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
);
SELECT public.workshop_mark_returned(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
);
SELECT public.workshop_start_storage(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
);
SELECT pg_temp.fill_storage((SELECT id FROM ws_uncheck_task));
SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'STORAGE-02'),
  NULL,
  NULL
);
SELECT is(
  public.workshop_complete_storage(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
  ) ->> 'code',
  'INCOMPLETE_CHECKLIST',
  'cleared required storage answer blocks completion'
);
SELECT public.workshop_set_item_outcome(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
  (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'STORAGE-02'),
  'not_applicable',
  NULL
);
SELECT public.workshop_complete_storage(
  (SELECT id FROM ws_uncheck_task),
  (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task))
);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_uncheck_task),
    (SELECT version FROM public.bike_tasks WHERE id = (SELECT id FROM ws_uncheck_task)),
    (SELECT id FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'STORAGE-02'),
    NULL,
    NULL
  ) ->> 'code',
  'INVALID_TRANSITION',
  'submitted storage rejects clearing an old item command'
);
SELECT is(
  (SELECT m1_outcome::text FROM public.bike_task_items WHERE task_id = (SELECT id FROM ws_uncheck_task) AND item_key = 'STORAGE-02'),
  'not_applicable',
  'rejected post-storage clear leaves the answer unchanged'
);
RESET ROLE;

-- Empty M2 list: every designated item is valid N/A
CREATE TEMP TABLE ws_empty_m2 AS
  SELECT pg_temp.make_task('workshop-road-bike', false, true, 'fp-v1') AS id;
GRANT SELECT ON ws_empty_m2 TO authenticated;
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT public.workshop_start_preparation((SELECT id FROM ws_empty_m2), 1);
SELECT pg_temp.fill_m1((SELECT id FROM ws_empty_m2));
RESET ROLE;
UPDATE public.bike_task_items
SET
  na_allowed = true,
  m1_outcome = 'not_applicable',
  m1_psi = NULL,
  m2_confirmed = false
WHERE task_id = (SELECT id FROM ws_empty_m2)
  AND stage = 'preparation'
  AND m2_verifies;
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT public.workshop_complete_m1(
  (SELECT id FROM ws_empty_m2),
  (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_empty_m2))
);
SELECT is(
  public.workshop_complete_m2(
    (SELECT id FROM ws_empty_m2),
    (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_empty_m2)),
    'fp-v1',
    true
  ) ->> 'status',
  'ready_for_pickup',
  'complete M2 with every designated item N/A → ready_for_pickup'
);
RESET ROLE;

-- Partner FORBIDDEN on every staff command; no row change
CREATE TEMP TABLE ws_partner_task AS
  SELECT pg_temp.make_task('workshop-road-bike', false, true) AS id,
         1 AS version_before,
         'to_prepare'::text AS status_before;
GRANT SELECT ON ws_partner_task TO authenticated;
SELECT pg_temp.become((SELECT partner FROM ws_ids));
SET ROLE authenticated;

SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'FORBIDDEN',
  'partner start_preparation → FORBIDDEN'
);
SELECT is(
  public.workshop_set_item_outcome(
    (SELECT id FROM ws_partner_task), 1, gen_random_uuid(), 'completed', NULL
  ) ->> 'code',
  'FORBIDDEN',
  'partner set_item_outcome → FORBIDDEN'
);
SELECT is(
  public.workshop_confirm_m2_item((SELECT id FROM ws_partner_task), 1, gen_random_uuid()) ->> 'code',
  'FORBIDDEN',
  'partner confirm_m2_item → FORBIDDEN'
);
SELECT is(
  public.workshop_confirm_m2_item((SELECT id FROM ws_partner_task), 1, gen_random_uuid(), false) ->> 'code',
  'FORBIDDEN',
  'partner unconfirm_m2_item → FORBIDDEN'
);
SELECT is(
  public.workshop_complete_m1((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'FORBIDDEN',
  'partner complete_m1 → FORBIDDEN'
);
SELECT is(
  public.workshop_complete_m2((SELECT id FROM ws_partner_task), 1, 'fp-v1', false) ->> 'code',
  'FORBIDDEN',
  'partner complete_m2 → FORBIDDEN'
);
SELECT is(
  public.workshop_mark_picked_up((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'FORBIDDEN',
  'partner mark_picked_up → FORBIDDEN'
);
SELECT is(
  public.workshop_mark_returned((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'FORBIDDEN',
  'partner mark_returned → FORBIDDEN'
);
SELECT is(
  public.workshop_start_storage((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'FORBIDDEN',
  'partner start_storage → FORBIDDEN'
);
SELECT is(
  public.workshop_complete_storage((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'FORBIDDEN',
  'partner complete_storage → FORBIDDEN'
);
SELECT is(
  public.workshop_task_detail((SELECT id FROM ws_partner_task)),
  NULL,
  'partner workshop_task_detail is null'
);
SELECT is(
  (SELECT count(*)::integer FROM public.bike_tasks),
  0,
  'partner SELECT on bike_tasks is empty'
);

RESET ROLE;

SELECT is(
  (SELECT t.version FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_partner_task)),
  1,
  'partner RPCs do not change version'
);
SELECT is(
  (SELECT t.status::text FROM public.bike_tasks t WHERE t.id = (SELECT id FROM ws_partner_task)),
  'to_prepare',
  'partner RPCs do not change status'
);

-- Invalid transition, stale version, cancelled
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT is(
  public.workshop_mark_picked_up((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'INVALID_TRANSITION',
  'pickup from to_prepare → INVALID_TRANSITION'
);
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_partner_task), 99) ->> 'code',
  'STALE_VERSION',
  'wrong expectedVersion → STALE_VERSION'
);
RESET ROLE;

UPDATE public.bike_tasks
SET status = 'cancelled'
WHERE id = (SELECT id FROM ws_partner_task);

SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT is(
  public.workshop_start_preparation((SELECT id FROM ws_partner_task), 1) ->> 'code',
  'TASK_CANCELLED',
  'cancelled task → TASK_CANCELLED'
);
RESET ROLE;

-- History immutability (after a successful signed transition)
SELECT throws_ok(
  format(
    'UPDATE public.bike_task_events SET event_kind = %L WHERE task_id = %L',
    'mutated',
    (SELECT road_task FROM ws_ids)
  ),
  '23001',
  NULL,
  'events reject UPDATE'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.bike_task_events WHERE task_id = %L',
    (SELECT road_task FROM ws_ids)
  ),
  '23001',
  NULL,
  'events reject DELETE'
);
SELECT throws_ok(
  format(
    'UPDATE public.bike_task_attestations SET first_name = %L WHERE task_id = %L',
    'Mutated',
    (SELECT road_task FROM ws_ids)
  ),
  '23001',
  NULL,
  'attestations reject UPDATE'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.bike_task_attestations WHERE task_id = %L',
    (SELECT road_task FROM ws_ids)
  ),
  '23001',
  NULL,
  'attestations reject DELETE'
);

-- Cancelled detail is a tombstone, not null
SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;
SELECT isnt(
  public.workshop_task_detail((SELECT id FROM ws_partner_task)),
  NULL,
  'cancelled task detail is a tombstone'
);
SELECT is(
  public.workshop_task_detail((SELECT id FROM ws_partner_task)) -> 'task' ->> 'status',
  'cancelled',
  'cancelled tombstone retains cancelled status'
);
RESET ROLE;

-- Mechanics can read the complete customer and order history, including
-- records unrelated to a workshop task, but no DML is granted.
INSERT INTO public.customers (id, name, email)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Task Customer', 'task-cust@test.local'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Orphan Customer', 'orphan-cust@test.local');

INSERT INTO public.partners (id, name, slug)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Task Partner', 'ws-task-partner'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Orphan Partner', 'ws-orphan-partner');

UPDATE public.orders o
SET customer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    partner_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
FROM public.bike_tasks t
WHERE t.id = (SELECT road_task FROM ws_ids)
  AND o.id = t.order_id;

INSERT INTO public.order_items (order_id, booqable_line_id, title, position)
SELECT t.order_id, 'line-task-' || t.order_id::text, 'Helmet', 1
FROM public.bike_tasks t
WHERE t.id = (SELECT road_task FROM ws_ids);

INSERT INTO public.orders (
  id, booqable_order_id, order_number, status, customer_id, partner_id, partner_promo
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bq-orphan-no-task',
  8001,
  'reserved',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'mechanic-visible'
);

INSERT INTO public.order_items (order_id, booqable_line_id, title, position)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'line-orphan-no-task',
  'Lock',
  1
);

INSERT INTO public.bike_fits (
  id, fit_number, customer_id, date_of_fit, bike_type, status
) VALUES (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  8001,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  date '2026-09-04',
  'road',
  'completed'
);

CREATE TEMP TABLE ws_order_select AS
SELECT
  t.order_id AS task_order_id,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid AS orphan_order_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AS task_customer_id,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid AS orphan_customer_id,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid AS task_partner_id,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid AS orphan_partner_id
FROM public.bike_tasks t
WHERE t.id = (SELECT road_task FROM ws_ids);

GRANT SELECT ON ws_order_select TO authenticated;

SELECT pg_temp.become((SELECT mechanic FROM ws_ids));
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer FROM public.orders
    WHERE id = (SELECT task_order_id FROM ws_order_select)),
  1,
  'mechanic can SELECT parent order of a bike task'
);
SELECT is(
  (SELECT count(*)::integer FROM public.orders
    WHERE id = (SELECT orphan_order_id FROM ws_order_select)),
  1,
  'mechanic can SELECT an order with no bike task'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bookings_view
    WHERE id = (SELECT orphan_order_id FROM ws_order_select)
  ),
  1,
  'mechanic can SELECT a no-task order from bookings_view'
);
SELECT is(
  (SELECT count(*)::integer FROM public.customers
    WHERE id = (SELECT task_customer_id FROM ws_order_select)),
  1,
  'mechanic can SELECT customer on a task order'
);
SELECT is(
  (SELECT count(*)::integer FROM public.customers
    WHERE id = (SELECT orphan_customer_id FROM ws_order_select)),
  1,
  'mechanic can SELECT customer on an order with no bike task'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.customer_directory
    WHERE id = (SELECT orphan_customer_id FROM ws_order_select)
  ),
  1,
  'mechanic can SELECT a no-task customer from customer_directory'
);
SELECT is(
  (SELECT count(*)::integer FROM public.partners
    WHERE id = (SELECT task_partner_id FROM ws_order_select)),
  1,
  'mechanic can SELECT partner on a task order'
);
SELECT is(
  (SELECT count(*)::integer FROM public.partners
    WHERE id = (SELECT orphan_partner_id FROM ws_order_select)),
  1,
  'mechanic can SELECT partner on an order with no bike task'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.customer_partner_history
    WHERE customer_id = (SELECT orphan_customer_id FROM ws_order_select)
      AND partner_id = (SELECT orphan_partner_id FROM ws_order_select)
  ),
  1,
  'mechanic can SELECT qualifying partner history for a no-task customer'
);
SELECT is(
  (SELECT count(*)::integer FROM public.order_items
    WHERE order_id = (SELECT task_order_id FROM ws_order_select)),
  1,
  'mechanic can SELECT items on a task order'
);
SELECT is(
  (SELECT count(*)::integer FROM public.order_items
    WHERE order_id = (SELECT orphan_order_id FROM ws_order_select)),
  1,
  'mechanic can SELECT items on an order with no bike task'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.bike_fits
    WHERE id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  1,
  'mechanic can SELECT a bike fit with no workshop task'
);
UPDATE public.orders
SET partner_promo = 'x'
WHERE id = (SELECT task_order_id FROM ws_order_select);

SELECT is(
  (
    SELECT o.partner_promo
    FROM public.orders o
    WHERE o.id = (SELECT task_order_id FROM ws_order_select)
  ),
  NULL,
  'mechanic cannot UPDATE a parent order'
);
UPDATE public.bike_fits
SET fit_label = 'Mutated'
WHERE id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
SELECT is(
  (
    SELECT fit_label
    FROM public.bike_fits
    WHERE id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ),
  'Baseline Fit'::text,
  'mechanic cannot UPDATE a bike fit'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
