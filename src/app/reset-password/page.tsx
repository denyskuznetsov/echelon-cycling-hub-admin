"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/utils/supabase/client";
import { validatePassword } from "@/src/utils/validation";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherArrowLeft } from "@subframe/core";
import { FeatherCheck } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";
import { FeatherLock } from "@subframe/core";

function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedPassword = password.trim();

    setErrorMessage("");
    setSuccessMessage("");

    const { isValid, errorMessage: passwordErrorMessage } = validatePassword(
      trimmedPassword
    );

    if (!isValid) {
      setErrorMessage(passwordErrorMessage);
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });

      if (error) {
        if (
          error.message.toLowerCase().includes("auth session missing") ||
          error.message.toLowerCase().includes("invalid jwt")
        ) {
          setErrorMessage(
            "This link is invalid or has expired. Please request a new password reset link or ask your admin to resend your invite."
          );
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      setSuccessMessage("Password updated. Redirecting you...");
      setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unexpected error while updating your password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-wrap items-start bg-default-background mobile:h-[100dvh] mobile:flex-col mobile:flex-wrap mobile:gap-0">
      <div className="relative flex max-w-[576px] grow shrink-0 basis-0 flex-col items-center gap-12 self-stretch overflow-hidden bg-[url('/login-hero.png')] bg-cover bg-left bg-no-repeat px-12 py-12 mobile:hidden">
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
                Reset your password and regain access to your account in minutes.
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
          <div className="flex w-full flex-col items-start justify-center gap-4">
            <span className="text-body font-body text-subtext-color">
              Set a new password for your account below.
            </span>
            <form
              className="flex w-full flex-col items-start justify-center gap-4"
              onSubmit={handleUpdatePassword}
            >
              <TextField
                className="h-auto w-full flex-none"
                label=""
                helpText=""
                icon={<FeatherLock />}
              >
                <TextField.Input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setPassword(event.target.value)
                  }
                />
              </TextField>
              <TextField
                className="h-auto w-full flex-none"
                label=""
                helpText=""
                icon={<FeatherLock />}
              >
                <TextField.Input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(event.target.value)
                  }
                />
              </TextField>
              <div className="flex w-full flex-wrap items-start gap-2 px-2 py-2">
                <div className="flex grow shrink-0 basis-0 flex-col items-start justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <FeatherCheck className="text-body font-body text-success-700" />
                    <span className="text-caption font-caption text-default-font">
                      Mixed case letters
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FeatherCheck className="text-body font-body text-success-700" />
                    <span className="text-caption font-caption text-default-font">
                      Minimum 6 characters
                    </span>
                  </div>
                </div>
                <div className="flex grow shrink-0 basis-0 flex-col items-start justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <FeatherCheck className="text-body font-body text-success-700" />
                    <span className="text-caption font-caption text-default-font">
                      Includes special characters
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FeatherCheck className="text-body font-body text-success-700" />
                    <span className="text-caption font-caption text-default-font">
                      Does not contain email
                    </span>
                  </div>
                </div>
              </div>
              <Button
                className="h-8 w-full flex-none"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
