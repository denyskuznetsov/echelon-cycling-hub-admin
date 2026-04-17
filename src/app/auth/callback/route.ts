import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  let errorMessage: string | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) errorMessage = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) errorMessage = error.message;
  } else {
    errorMessage = "Missing auth parameters (expected token_hash + type, or code).";
  }

  if (!errorMessage) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  console.error("[auth/callback] verification failed:", errorMessage);
  const loginUrl = new URL(`${origin}/login`);
  loginUrl.searchParams.set("error", errorMessage);
  return NextResponse.redirect(loginUrl);
}
