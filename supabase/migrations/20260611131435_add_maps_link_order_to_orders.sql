-- Google Maps URL for the order delivery/pickup location (from Booqable custom field).

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS maps_link_order text;
