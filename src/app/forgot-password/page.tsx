import React from "react";
import { requireAnonymous } from "@/src/utils/auth/requireAnonymous";
import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  // Already-signed-in users don't need the email recovery flow; bounce them
  // to their normal landing page. If they actually want to change their
  // password while signed in, they can go to /reset-password directly.
  await requireAnonymous();

  return <ForgotPasswordForm />;
}
