"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/utils/supabase/client";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherArrowLeft } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";
import { FeatherMail } from "@subframe/core";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Password reset link sent. Check your inbox.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unexpected error while sending the reset link."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-wrap items-start bg-default-background mobile:h-[100dvh] mobile:flex-col mobile:flex-wrap mobile:gap-0">
      <div className="relative flex max-w-[837px] grow shrink-0 basis-0 flex-col items-center gap-12 self-stretch overflow-hidden bg-[url('/login-hero.png')] bg-cover bg-left bg-no-repeat px-12 py-12 mobile:hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,47,80,0.3)] to-[rgba(28,70,106,0.8)]" />
        <div className="relative z-10 flex w-full max-w-[448px] grow shrink-0 basis-0 flex-col items-start justify-center gap-12 mobile:h-auto mobile:w-full mobile:max-w-[448px] mobile:flex-none">
          <img
            className="h-24 flex-none object-cover"
            src="https://iwawhxfptzimluqyebiq.supabase.co/storage/v1/object/public/echelon-assets/logo%20dots%20orange.png"
          />
          <div className="flex flex-col items-start justify-center gap-16 mobile:px-0 mobile:py-0">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-2 font-heading-2 text-white">
                Secure your account
              </span>
              <span className="text-heading-3 font-heading-3 text-white/80 italic">
                Reset your password and regain access to your account in
                minutes.
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="relative flex grow shrink-0 basis-0 flex-col items-center justify-center gap-6 self-stretch overflow-hidden border-l border-solid border-neutral-border px-12 py-12 mobile:border-l-0 mobile:bg-[url('/login-hero.png')] mobile:bg-cover mobile:bg-left mobile:bg-no-repeat mobile:px-4 mobile:py-4">
        <div className="hidden mobile:block absolute inset-0 bg-gradient-to-b from-[rgba(0,47,80,0.3)] to-[rgba(28,70,106,0.8)]" />
        <img
          className="relative z-10 hidden h-24 flex-none object-contain mobile:block"
          src="https://iwawhxfptzimluqyebiq.supabase.co/storage/v1/object/public/echelon-assets/logo%20dots%20orange.png"
        />
        <div className="relative z-10 flex w-full max-w-[448px] flex-col items-start justify-center gap-8 mobile:rounded-lg mobile:bg-default-background mobile:p-6 mobile:shadow-lg">
          <div className="flex w-full flex-col items-start gap-1">
            <span className="w-full text-heading-2 font-heading-2 text-default-font">
              Reset your password
            </span>
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-body font-body text-subtext-color">
                Remember your password?
              </span>
              <LinkButton
                variant="brand"
                iconRight={<FeatherChevronRight />}
                onClick={() => router.push("/login")}
              >
                Sign In
              </LinkButton>
            </div>
          </div>
          <form
            className="flex w-full flex-col items-start justify-center gap-4"
            onSubmit={handleSendResetLink}
          >
            <span className="text-body font-body text-subtext-color">
              Enter your email address and we&#39;ll send you a link to reset
              your password.
            </span>
            <TextField
              className="h-auto w-full flex-none"
              label=""
              helpText=""
              icon={<FeatherMail />}
            >
              <TextField.Input
                placeholder="Email address"
                value={email}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(event.target.value)
                }
              />
            </TextField>
            <Button
              className="h-8 w-full flex-none"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </Button>
            {errorMessage ? (
              <span className="text-caption font-caption text-error-700">
                {errorMessage}
              </span>
            ) : null}
            {successMessage ? (
              <span className="text-caption font-caption text-success-700">
                {successMessage}
              </span>
            ) : null}
            <div className="flex w-full items-center justify-center gap-2 pt-4">
              <LinkButton
                variant="neutral"
                icon={<FeatherArrowLeft />}
                onClick={() => router.push("/login")}
              >
                Back to Sign In
              </LinkButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
