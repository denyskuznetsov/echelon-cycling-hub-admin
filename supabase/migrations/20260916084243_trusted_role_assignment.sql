-- New Auth identities are pending until an operator assigns their trusted
-- profile role in the Supabase dashboard.  This migration intentionally does
-- not rewrite existing profile rows or their partner associations.

ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- raw_user_meta_data is caller-editable: only names are copied from it.
  INSERT INTO public.profiles (id, first_name, last_name, role, partner_id)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    NULL,
    NULL
  );
  RETURN new;
END;
$$;

-- Auth's trigger runs as the Auth owner. Keep the dashboard's privileged
-- operational write path while removing all browser/Data API profile writes.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM anon, authenticated;

-- A pending row can be malformed or temporarily associated by a privileged
-- operator. Association-only policies must still not reveal business data.
DROP POLICY IF EXISTS "Partners can view own partner data" ON public.partners;
CREATE POLICY "Partners can view own partner data"
ON public.partners FOR SELECT TO authenticated
USING (
  public.get_user_role() IS NOT NULL
  AND id = (
    SELECT profiles.partner_id
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Partners see own orders" ON public.orders;
CREATE POLICY "Partners see own orders"
ON public.orders FOR SELECT TO authenticated
USING (
  public.get_user_role() IS NOT NULL
  AND partner_id = (
    SELECT profiles.partner_id
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Partners can read customers on their orders" ON public.customers;
CREATE POLICY "Partners can read customers on their orders"
ON public.customers FOR SELECT TO authenticated
USING (
  public.get_user_role() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.customer_id = customers.id
      AND o.partner_id = (
        SELECT profiles.partner_id
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Partners see items on own orders" ON public.order_items;
CREATE POLICY "Partners see items on own orders"
ON public.order_items FOR SELECT TO authenticated
USING (
  public.get_user_role() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.partner_id = (
        SELECT profiles.partner_id
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Partners see own marketing links" ON public.marketing_links;
CREATE POLICY "Partners see own marketing links"
ON public.marketing_links FOR SELECT TO authenticated
USING (
  public.get_user_role() IS NOT NULL
  AND partner_id = (
    SELECT profiles.partner_id
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
  )
);

-- This function is SECURITY DEFINER because users may acknowledge only their
-- own onboarding state. It must not offer pending users a business mutation.
CREATE OR REPLACE FUNCTION public.acknowledge_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'Account pending activation' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET onboarding_completed_at = now()
  WHERE id = (SELECT auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acknowledge_onboarding() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.acknowledge_onboarding() FROM anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_onboarding() TO authenticated;
