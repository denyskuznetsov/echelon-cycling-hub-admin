import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type JsonApiResource = {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships?: Record<string, { data?: { id: string; type: string } | null }>;
};

function formatBirthday(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const parts = dateStr.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    return dateStr;
  }

  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return null;
}

export async function GET(_request: Request) {
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

    while (hasMorePages) {
      const params = new URLSearchParams({
        "page[size]": "50",
        "page[number]": page.toString(),
        include: "customer,coupon",
      });
      const url = `https://${slug}.booqable.com/api/4/orders?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(
          "[seed-orders] non-OK response on page",
          page,
          res.status,
          body,
        );
        break;
      }

      const payload = (await res.json()) as {
        data?: JsonApiResource[];
        included?: JsonApiResource[];
      };
      const data = payload.data ?? [];
      const included = payload.included ?? [];

      if (!Array.isArray(data) || data.length === 0) {
        hasMorePages = false;
        break;
      }

      for (const order of data) {
        try {
          let supabaseCustomerId: string | null = null;
          const customerId = order.relationships?.customer?.data?.id;
          if (customerId) {
            const customer = included.find(
              (i) => i.type === "customers" && i.id === customerId,
            );
            if (customer) {
              const { data: upserted, error: customerError } = await supabase
                .from("customers")
                .upsert(
                  {
                    booqable_customer_id: customer.id,
                    name: customer.attributes.name,
                    email: customer.attributes.email,
                    phone: customer.attributes.properties?.phone || null,
                    birthday: formatBirthday(
                      customer.attributes.properties?.birthday_date,
                    ),
                  },
                  { onConflict: "booqable_customer_id" },
                )
                .select("id")
                .single();

              if (customerError) throw customerError;
              supabaseCustomerId = upserted?.id ?? null;
            }
          }

          const partnerPromo: string | null =
            order.attributes.properties?.partner_promo || null;
          let supabasePartnerId: string | null = null;
          if (partnerPromo) {
            const { data: partnerRow, error: partnerError } = await supabase
              .from("partners")
              .select("id")
              .eq("promo_code", partnerPromo)
              .maybeSingle();

            if (partnerError) throw partnerError;
            supabasePartnerId = partnerRow?.id ?? null;
          }

          let couponCodeValue: string | null = null;
          const couponId = order.relationships?.coupon?.data?.id;
          if (couponId) {
            const coupon = included.find(
              (i) => i.type === "coupons" && i.id === couponId,
            );
            couponCodeValue = coupon?.attributes.value || null;
          }

          const { data: existingOrder, error: existingError } = await supabase
            .from("orders")
            .select("id")
            .eq("booqable_order_id", order.id)
            .maybeSingle();

          if (existingError) throw existingError;
          if (existingOrder) {
            continue;
          }

          const { error: insertError } = await supabase.from("orders").insert({
            booqable_order_id: order.id,
            order_number: order.attributes.number,
            status: order.attributes.status,
            starts_at: order.attributes.starts_at,
            stops_at: order.attributes.stops_at,
            fulfillment_type: order.attributes.fulfillment_type || null,
            delivery_address:
              order.attributes.properties?.delivery_address || null,
            billing_address:
              order.attributes.properties?.billing_address || null,
            amount_in_cents: order.attributes.amount_in_cents || 0,
            discount_type: order.attributes.discount_type || null,
            discount_percentage: order.attributes.discount_percentage || null,
            coupon_discount_in_cents:
              order.attributes.coupon_discount_in_cents || null,
            coupon_code_value: couponCodeValue,
            customer_id: supabaseCustomerId,
            partner_id: supabasePartnerId,
            partner_promo: partnerPromo,
          });

          if (insertError) throw insertError;
          totalProcessed++;
        } catch (orderErr) {
          console.error(
            "[seed-orders] failed order",
            order.id,
            orderErr,
          );
          continue;
        }
      }

      if (data.length < 50) {
        hasMorePages = false;
      } else {
        page++;
      }
    }

    return NextResponse.json({ success: true, totalProcessed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[seed-orders] fatal error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
