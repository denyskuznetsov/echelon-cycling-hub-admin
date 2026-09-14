-- Allow active workshop checklist answers and M2 confirmations to be cleared.
-- Stage/status, authorization, and optimistic-version guards remain unchanged.

CREATE OR REPLACE FUNCTION private.workshop_set_item_outcome(
  p_task_id uuid,
  p_expected_version integer,
  p_item_id uuid,
  p_outcome text,
  p_psi numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctx private.workshop_begin_result;
  v_item public.bike_task_items;
  v_outcome public.checklist_item_outcome;
  v_task public.bike_tasks;
  v_expected_stage public.bike_task_item_stage;
BEGIN
  v_ctx := private.workshop_begin_command(p_task_id, p_expected_version, false);
  IF v_ctx.err IS NOT NULL THEN
    RETURN v_ctx.err;
  END IF;

  SELECT * INTO v_item
  FROM public.bike_task_items i
  WHERE i.id = p_item_id AND i.task_id = v_ctx.task_id
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RETURN private.workshop_err('INVALID_TRANSITION', 'Checklist item not found.');
  END IF;

  IF v_ctx.status = 'being_prepared'::public.bike_task_status THEN
    v_expected_stage := 'preparation';
  ELSIF v_ctx.status = 'prepare_for_storage'::public.bike_task_status THEN
    v_expected_stage := 'storage';
  ELSE
    RETURN private.workshop_err('INVALID_TRANSITION', 'Items cannot be updated in this status.');
  END IF;

  IF v_item.stage <> v_expected_stage THEN
    RETURN private.workshop_err('INVALID_TRANSITION', 'Item is not part of the current stage.');
  END IF;

  IF p_outcome IS NOT NULL AND p_outcome NOT IN ('completed', 'not_applicable') THEN
    RETURN private.workshop_err('INCOMPLETE_CHECKLIST', 'Outcome must be completed, not applicable, or cleared.');
  END IF;

  v_outcome := p_outcome::public.checklist_item_outcome;

  IF v_outcome = 'not_applicable'::public.checklist_item_outcome AND NOT v_item.na_allowed THEN
    RETURN private.workshop_err('INCOMPLETE_CHECKLIST', 'This item does not allow N/A.');
  END IF;

  IF v_outcome = 'completed'::public.checklist_item_outcome
     AND v_item.item_type = 'tyre_pressure_psi'::public.checklist_item_type
     AND (p_psi IS NULL OR p_psi <= 0) THEN
    RETURN private.workshop_err('INCOMPLETE_CHECKLIST', 'PSI value is required.');
  END IF;

  UPDATE public.bike_task_items
  SET m1_outcome = v_outcome,
      m1_psi = CASE
        WHEN v_outcome = 'completed'::public.checklist_item_outcome
          AND v_item.item_type = 'tyre_pressure_psi'::public.checklist_item_type
          THEN p_psi
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = v_item.id;

  v_task := private.workshop_bump_task(v_ctx.task_id, v_ctx.status);
  PERFORM private.workshop_record_event(
    v_task.id, 'item_outcome', v_task.status, v_task.status, v_task.version,
    v_ctx.user_id, v_ctx.first_name, v_ctx.last_name, NULL
  );
  RETURN private.workshop_ok(v_task);
END;
$$;

CREATE OR REPLACE FUNCTION private.workshop_confirm_m2_item(
  p_task_id uuid,
  p_expected_version integer,
  p_item_id uuid,
  p_checked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctx private.workshop_begin_result;
  v_item public.bike_task_items;
  v_task public.bike_tasks;
BEGIN
  v_ctx := private.workshop_begin_command(p_task_id, p_expected_version, false);
  IF v_ctx.err IS NOT NULL THEN
    RETURN v_ctx.err;
  END IF;

  IF p_checked IS NULL THEN
    RETURN private.workshop_err('INVALID_TRANSITION', 'M2 checked state is required.');
  END IF;

  IF v_ctx.status <> 'needs_recheck'::public.bike_task_status THEN
    RETURN private.workshop_err('INVALID_TRANSITION', 'M2 confirmation is only allowed during re-check.');
  END IF;

  SELECT * INTO v_item
  FROM public.bike_task_items i
  WHERE i.id = p_item_id AND i.task_id = v_ctx.task_id
  FOR UPDATE;

  IF v_item.id IS NULL OR v_item.stage <> 'preparation'::public.bike_task_item_stage THEN
    RETURN private.workshop_err('INVALID_TRANSITION', 'Checklist item not found.');
  END IF;

  IF NOT v_item.m2_verifies THEN
    RETURN private.workshop_err('INVALID_TRANSITION', 'This item is not designated for M2.');
  END IF;

  IF NOT private.workshop_item_m1_valid(v_item) THEN
    RETURN private.workshop_err('INCOMPLETE_CHECKLIST', 'M1 outcome must be valid before M2 confirmation.');
  END IF;

  UPDATE public.bike_task_items
  SET m2_confirmed = p_checked,
      updated_at = now()
  WHERE id = v_item.id;

  v_task := private.workshop_bump_task(v_ctx.task_id, v_ctx.status);
  PERFORM private.workshop_record_event(
    v_task.id,
    CASE WHEN p_checked THEN 'm2_confirmed' ELSE 'm2_unconfirmed' END,
    v_task.status, v_task.status, v_task.version,
    v_ctx.user_id, v_ctx.first_name, v_ctx.last_name, NULL
  );
  RETURN private.workshop_ok(v_task);
END;
$$;

CREATE OR REPLACE FUNCTION public.workshop_confirm_m2_item(
  task_id uuid,
  expected_version integer,
  item_id uuid,
  checked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN private.workshop_confirm_m2_item(task_id, expected_version, item_id, checked);
END;
$$;

REVOKE ALL ON FUNCTION private.workshop_confirm_m2_item(uuid, integer, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.workshop_confirm_m2_item(uuid, integer, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.workshop_confirm_m2_item(uuid, integer, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.workshop_confirm_m2_item(uuid, integer, uuid, boolean) FROM anon;

GRANT EXECUTE ON FUNCTION private.workshop_confirm_m2_item(uuid, integer, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workshop_confirm_m2_item(uuid, integer, uuid, boolean) TO authenticated;
