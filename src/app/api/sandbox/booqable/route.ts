import { NextResponse } from "next/server";

export async function GET() {
  try {
    const slug = process.env.BOOQABLE_COMPANY_SLUG;
    const apiKey = process.env.BOOQABLE_API_KEY;
    if (!slug || !apiKey) {
      throw new Error(
        "Missing BOOQABLE_COMPANY_SLUG or BOOQABLE_API_KEY env var",
      );
    }

    const params = new URLSearchParams({
      "page[size]": "1",
      "page[number]": "1",
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
        "[sandbox/booqable] non-OK response",
        res.status,
        body,
      );
      return NextResponse.json(
        { error: "Booqable request failed", status: res.status, body },
        { status: res.status },
      );
    }

    const data = await res.json();
    console.log(
      "[sandbox/booqable] orders payload:",
      JSON.stringify(data, null, 2),
    );
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sandbox/booqable] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
