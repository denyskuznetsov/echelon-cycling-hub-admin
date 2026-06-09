-- profiles: "Users can view own profile"
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING ((select auth.uid()) = id);

-- partners: "Partners can view own partner data"
DROP POLICY IF EXISTS "Partners can view own partner data" ON public.partners;
CREATE POLICY "Partners can view own partner data"
  ON public.partners FOR SELECT
  USING (id = (
    SELECT profiles.partner_id FROM public.profiles
    WHERE profiles.id = (select auth.uid())
  ));

-- orders: "Partners see own orders"
DROP POLICY IF EXISTS "Partners see own orders" ON public.orders;
CREATE POLICY "Partners see own orders"
  ON public.orders FOR SELECT
  USING (partner_id = (
    SELECT profiles.partner_id FROM public.profiles
    WHERE profiles.id = (select auth.uid())
  ));

-- customers: "Partners can read customers on their orders"
DROP POLICY IF EXISTS "Partners can read customers on their orders" ON public.customers;
CREATE POLICY "Partners can read customers on their orders"
  ON public.customers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = customers.id
      AND o.partner_id = (
        SELECT profiles.partner_id FROM public.profiles
        WHERE profiles.id = (select auth.uid())
      )
  ));

-- get_user_role() — also wraps auth.uid() so admin/manager policies benefit too
CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS public.user_role
  LANGUAGE sql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = (select auth.uid());
$$;
