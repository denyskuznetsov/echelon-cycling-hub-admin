import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { getActiveProfileAccess } from "@/src/lib/profile";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth — return 401 rather than redirect() since this is a fetch-called route.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getActiveProfileAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  // Parse and validate body.
  let body: {
    longUrl?: string;
    title?: string;
    partnerId?: string | null;
    assignment?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { longUrl, title, partnerId, assignment } = body;

  if (!longUrl) {
    return NextResponse.json({ error: "longUrl is required" }, { status: 400 });
  }

  try {
    new URL(longUrl);
  } catch {
    return NextResponse.json(
      { error: "longUrl must be a valid URL" },
      { status: 400 },
    );
  }

  const resolvedPartnerId =
    assignment === "partner" ? (partnerId ?? null) : null;

  // Dedup check — match on long_url alone so one URL can only ever have one row.
  const { data: existing, error: dedupError } = await supabase
    .from("marketing_links")
    .select("short_url, partner_id")
    .eq("long_url", longUrl)
    .limit(1)
    .maybeSingle();

  if (dedupError) {
    console.error("[links/create] Dedup check failed:", dedupError);
    return NextResponse.json(
      {
        error: "Failed to check for existing links",
        message: dedupError.message,
      },
      { status: 500 },
    );
  }

  if (existing) {
    const isSameOwner = existing.partner_id === resolvedPartnerId;

    if (isSameOwner) {
      return NextResponse.json(
        {
          shortUrl: existing.short_url,
          isExisting: true,
          message: "An active short link already exists for this target URL.",
        },
        { status: 200 },
      );
    }

    // Different owner — resolve a readable label to surface in the error.
    let ownerLabel = "internal use";
    if (existing.partner_id) {
      const { data: partnerRow } = await supabase
        .from("partners")
        .select("name")
        .eq("id", existing.partner_id)
        .maybeSingle();
      ownerLabel = partnerRow?.name ?? "another partner";
    }

    return NextResponse.json(
      {
        error: `This exact URL already has a short link assigned to ${ownerLabel}. Change the UTM parameters (e.g. utm_source) to create a distinct link for this partner.`,
      },
      { status: 409 },
    );
  }

  // Guard against missing env vars at runtime (programmer error — throw loudly).
  const shortIoKey = process.env.SHORT_IO_SECRET_KEY;
  const shortIoDomain = process.env.SHORT_IO_DOMAIN;

  if (!shortIoKey || !shortIoDomain) {
    throw new Error(
      "Missing SHORT_IO_SECRET_KEY or SHORT_IO_DOMAIN environment variables.",
    );
  }

  // Call Short.io.
  const shortIoResponse = await fetch("https://api.short.io/links", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: shortIoKey,
    },
    body: JSON.stringify({
      domain: shortIoDomain,
      originalURL: longUrl,
      title: title || undefined,
      allowDuplicates: false,
    }),
  });

  if (!shortIoResponse.ok) {
    const shortIoErrorBody = await shortIoResponse.text();
    console.error("[links/create] Short.io error:", shortIoErrorBody);
    return NextResponse.json(
      { error: "Failed to create short link", message: shortIoErrorBody },
      { status: 500 },
    );
  }

  const shortIoData = (await shortIoResponse.json()) as {
    shortURL: string;
    idString: string;
  };

  // Build a title fallback from the UTM params when none was provided.
  const resolvedTitle =
    title?.trim() ||
    (() => {
      try {
        const url = new URL(longUrl);
        const source = url.searchParams.get("utm_source") ?? "";
        const campaign = url.searchParams.get("utm_campaign") ?? "";
        return [source, campaign].filter(Boolean).join(" - ") || "Untitled Link";
      } catch {
        return "Untitled Link";
      }
    })();

  // Persist to Supabase.
  const { error: insertError } = await supabase.from("marketing_links").insert({
    short_url: shortIoData.shortURL,
    long_url: longUrl,
    short_io_id: shortIoData.idString,
    partner_id: resolvedPartnerId,
    created_by: user.id,
    title: resolvedTitle,
  });

  if (insertError) {
    console.error("[links/create] DB insert failed:", insertError);
    return NextResponse.json(
      {
        error:
          "Short link was created but could not be saved. Please retry — the link will be recovered automatically.",
        message: insertError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      shortUrl: shortIoData.shortURL,
      isExisting: false,
      message: "Short link successfully generated!",
    },
    { status: 201 },
  );
}
