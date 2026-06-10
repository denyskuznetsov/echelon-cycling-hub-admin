-- Order items synced from Booqable order "lines" (one row per rented item /
-- charge / delivery rate on an order), plus extra order-level money/status
-- fields from the Booqable API v4 that the webhook previously dropped.

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  booqable_line_id text NOT NULL UNIQUE,
  booqable_item_id text,
  parent_booqable_line_id text,
  title text,
  quantity integer,
  line_type text,
  charge_label text,
  extra_information text,
  price_each_in_cents integer,
  price_in_cents integer,
  position integer,
  relevant boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items (order_id);

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Read access mirrors the orders table: admins/managers see everything,
-- partners only see items belonging to their own orders.
-- Writes happen exclusively through the service role (webhook/backfill),
-- so no INSERT/UPDATE/DELETE policies are defined.
DROP POLICY IF EXISTS "Admins see all order items" ON public.order_items;
CREATE POLICY "Admins see all order items"
  ON public.order_items FOR SELECT
  USING (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]));

DROP POLICY IF EXISTS "Partners see items on own orders" ON public.order_items;
CREATE POLICY "Partners see items on own orders"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.partner_id = (
        SELECT profiles.partner_id FROM public.profiles
        WHERE profiles.id = (select auth.uid())
      )
  ));

-- Order-level fields newly synced from Booqable API v4.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deposit_in_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_in_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS grand_total_with_tax_in_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS to_be_paid_in_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS item_count integer;
