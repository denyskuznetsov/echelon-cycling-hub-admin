"use server";

import { createElement } from "react";
import { Resend } from "resend";
import type { User } from "@supabase/supabase-js";
import { withAuth } from "@/src/utils/auth/with-auth";
import { getActiveProfileAccess } from "@/src/lib/profile";
import { CONTACT_EMAIL } from "@/ui/layouts/brand-assets";
import { ContactRequestEmail } from "../../emails/ContactRequestEmail";
import {
  contactFormSchema,
  type ContactFormValues,
} from "@/src/lib/contact-schema";

export type ContactResult = { ok: true } | { ok: false; error: string };

export const sendContactRequest = withAuth(
  "sendContactRequest",
  sendContactRequestAction,
);

async function sendContactRequestAction(
  user: User,
  values: ContactFormValues,
): Promise<ContactResult> {
  const access = await getActiveProfileAccess();
  if (!access.ok) return access;

  const parsed = contactFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Invalid submission. Please check your inputs." };
  }

  if (!parsed.data.consent) {
    return { ok: false, error: "Consent to data processing is required." };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("sendContactRequest: RESEND_API_KEY is not set");
    return { ok: false, error: "Email service is not configured." };
  }

  const consentAt = new Date().toISOString();
  const resend = new Resend(resendApiKey);

  const { error: sendError } = await resend.emails.send({
    from:
      process.env.RESEND_FROM_EMAIL ??
      "Echelon Cycling Hub <info@echeloncyclinghub.com>",
    to: [CONTACT_EMAIL],
    subject: "New request from Echelon Cycling Hub Admin",
    replyTo: parsed.data.email,
    react: createElement(ContactRequestEmail, {
      ...parsed.data,
      consentAt,
      submittingUserEmail: user.email ?? "unknown",
    }),
  });

  if (sendError) {
    console.error("sendContactRequest send:", sendError);
    return {
      ok: false,
      error: "Could not send the message. Please try again.",
    };
  }

  return { ok: true };
}
