import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBooqableOrder } from "@/src/lib/booqable/sync";

export const dynamic = "force-dynamic";

/**
 * One-off backfill: pages through every Booqable order and runs the same
 * syncBooqableOrder used by the webhook, so existing orders get their
 * order_items and the newer order-level fields populated.
 */
export async function GET(_request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const slug = process.env.BOOQABLE_COMPANY_SLUG;
    const apiKey = process.env.BOOQABLE_API_KEY;
    if (!slug || !apiKey) {
      throw new Error(
        "Missing BOOQABLE_COMPANY_SLUG or BOOQABLE_API_KEY env var",
      );
    }

    let page = 1;
    let hasMorePages = true;
    let totalProcessed = 0;
    const failures: Array<{ id: string; error: string }> = [];

    while (hasMorePages) {
      const params = new URLSearchParams({
        "page[size]": "50",
        "page[number]": page.toString(),
        "fields[orders]": "id,status,number",
      });
      const url = `https://${slug}.booqable.com/api/4/orders?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(
          "[sync-orders] non-OK list response on page",
          page,
          res.status,
          body,
        );
        break;
      }

      const payload = (await res.json()) as {
        data?: Array<{
          id: string;
          attributes?: { status?: string; number?: number | null };
        }>;
      };
      const data = payload.data ?? [];

      if (data.length === 0) {
        hasMorePages = false;
        break;
      }

      for (const order of data) {
        // Same ghost-order filter as the webhook
        const status = order.attributes?.status;
        const number = order.attributes?.number;
        if (status === "new" || status === "concept" || !number) {
          continue;
        }

        try {
          await syncBooqableOrder(supabase, order.id);
          totalProcessed++;
        } catch (orderErr) {
          const message =
            orderErr instanceof Error ? orderErr.message : "Unknown error";
          console.error("[sync-orders] failed order", order.id, orderErr);
          failures.push({ id: order.id, error: message });
        }
      }

      if (data.length < 50) {
        hasMorePages = false;
      } else {
        page++;
      }
    }

    return NextResponse.json({ success: true, totalProcessed, failures });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-orders] fatal error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
