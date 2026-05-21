import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import {
  computeDateThreshold,
  loadPartnerDailyStats,
  normalizeCommissionRate,
  resolveTimeframe,
} from "@/src/app/partner/_lib/loadPartnerOverview";
import type { PartnerOrderStatus } from "@/src/app/partner/_components/types";

export const dynamic = "force-dynamic";

type ReportOrderRow = {
  id: string;
  order_number: number | string | null;
  status: PartnerOrderStatus | null;
  created_at: string | null;
  amount_in_cents: number | null;
  customer_name: string | null;
  customer_email: string | null;
};

const TIMEFRAME_LABELS: Record<string, string> = {
  week: "Past Week",
  month: "Past Month",
  "all-time": "All-Time",
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

function escapeCsvField(value: string | null | undefined): string {
  const raw = value ?? "";
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const partnerId = request.nextUrl.searchParams.get("partner_id");
  const timeframeParam =
    request.nextUrl.searchParams.get("timeframe") ?? undefined;

  if (!partnerId) {
    return NextResponse.json(
      { error: "partner_id is required" },
      { status: 400 },
    );
  }

  const timeframe = resolveTimeframe(timeframeParam);
  const startDate = computeDateThreshold(timeframe);

  const supabase = await createClient();

  const { data: partnerRow, error: partnerError } = await supabase
    .from("partners")
    .select("commission_rate")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError) {
    return NextResponse.json(
      { error: "Failed to load partner", message: partnerError.message },
      { status: 500 },
    );
  }

  if (!partnerRow) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const commissionRate = normalizeCommissionRate(partnerRow.commission_rate);

  const dailyStats = await loadPartnerDailyStats(partnerId, startDate);

  const { totalOrderValueCents, totalOrders } = dailyStats.reduce(
    (acc, stat) => {
      acc.totalOrderValueCents += toNumber(stat.daily_cents);
      acc.totalOrders += toNumber(stat.daily_orders);
      return acc;
    },
    { totalOrderValueCents: 0, totalOrders: 0 },
  );
  const totalCommissionCents = (totalOrderValueCents * commissionRate) / 100;

  let ordersQuery = supabase
    .from("bookings_view")
    .select(
      "id, order_number, status, created_at, amount_in_cents, customer_name, customer_email",
    )
    .eq("partner_id", partnerId);

  if (startDate) {
    ordersQuery = ordersQuery.gte("created_at", startDate);
  }

  const { data: ordersData, error: ordersError } = await ordersQuery.order(
    "created_at",
    { ascending: false },
  );

  if (ordersError) {
    return NextResponse.json(
      { error: "Failed to load orders", message: ordersError.message },
      { status: 500 },
    );
  }

  const orders = (ordersData as ReportOrderRow[] | null) ?? [];

  const timeframeLabel = TIMEFRAME_LABELS[timeframe] ?? timeframe;

  const totalCommissionWithIvaCents = totalCommissionCents * 1.21;

  const lines: string[] = [];
  lines.push(
    [
      "Report Timeframe",
      "Total Orders",
      "Total Value (EUR)",
      "Total Commission (EUR) without IVA 21%",
      "Total Commission (EUR) with IVA 21%",
    ]
      .map(escapeCsvField)
      .join(","),
  );
  lines.push(
    [
      escapeCsvField(timeframeLabel),
      String(totalOrders),
      centsToEuros(totalOrderValueCents),
      centsToEuros(totalCommissionCents),
      centsToEuros(totalCommissionWithIvaCents),
    ].join(","),
  );
  lines.push("");
  lines.push(
    [
      "Order Number",
      "Date",
      "Customer Name",
      "Customer Email",
      "Status",
      "Order Value (EUR)",
      "Order Commission (EUR) without IVA 21%",
      "Commission (EUR) with IVA 21%",
    ]
      .map(escapeCsvField)
      .join(","),
  );

  for (const order of orders) {
    const orderNumber =
      order.order_number != null ? String(order.order_number) : "";
    const dateText = order.created_at
      ? new Date(order.created_at).toISOString().slice(0, 10)
      : "";
    const orderCents = toNumber(order.amount_in_cents);
    const orderCommissionCents = (orderCents * commissionRate) / 100;
    const orderCommissionWithIvaCents = orderCommissionCents * 1.21;
    lines.push(
      [
        escapeCsvField(orderNumber),
        escapeCsvField(dateText),
        escapeCsvField(order.customer_name),
        escapeCsvField(order.customer_email),
        escapeCsvField(order.status ?? ""),
        centsToEuros(orderCents),
        centsToEuros(orderCommissionCents),
        centsToEuros(orderCommissionWithIvaCents),
      ].join(","),
    );
  }

  const csvString = lines.join("\n");

  return new NextResponse(csvString, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
