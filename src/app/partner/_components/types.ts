import type { BookingRow, OrderStatus } from "@/src/lib/orders";

export type PartnerOrderStatus = OrderStatus;

export type PartnerOrder = {
  id: string;
  status: PartnerOrderStatus | null;
  starts_at: string;
  stops_at: string;
  amount_in_cents: number | null;
  customers: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export type PartnerBookingRow = BookingRow;

export type PartnerCustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  partner_id: string | null;
  order_numbers: (number | string)[] | null;
  order_numbers_text: string | null;
};

export type PartnerRow = {
  id: string;
  name: string;
  location: string;
  promo_code: string;
  slug: string;
  commission_rate: number | null;
  hero_image_url: string | null;
};

export type PartnerDailyStat = {
  stat_date: string;
  daily_orders: number | string | null;
  daily_cents: number | string | null;
};

export type PartnerDailyChartPoint = {
  Date: string;
  Orders: number;
  "Total Order Value": number;
  "Your Commission": number;
};
