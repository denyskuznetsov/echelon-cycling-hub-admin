export type PartnerOrderStatus =
  | "draft"
  | "new"
  | "canceled"
  | "reserved"
  | "started"
  | "stopped"
  | "archived";

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

export type PartnerBookingRow = {
  id: string;
  order_number: number | string | null;
  status: PartnerOrderStatus | null;
  starts_at: string;
  stops_at: string;
  amount_in_cents: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

export type PartnerRow = {
  id: string;
  name: string;
  location: string;
  promo_code: string;
  slug: string;
  commission_rate: number | null;
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
