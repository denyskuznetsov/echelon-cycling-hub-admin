"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/src/utils/supabase/client";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherArrowLeft } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";

function VerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [countdown]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email) {
      setError("Missing email. Please return to Sign Up and try again.");
      return;
    }

    const enteredCode = code.join("");
    if (enteredCode.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: enteredCode,
        type: "signup",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Unable to verify code. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Missing email. Please return to Sign Up and try again.");
      return;
    }

    if (countdown > 0) return;

    setError("");
    setSuccessMessage("");

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setSuccessMessage("A new code has been sent.");
      setCountdown(60);
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend code. Please try again."
      );
    }
  };

  return (
    <div className="flex h-full w-full flex-wrap items-start bg-default-background mobile:flex-col mobile:flex-nowrap mobile:gap-0">
      <div className="flex max-w-[576px] grow shrink-0 basis-0 flex-col items-center gap-12 self-stretch bg-neutral-50 px-12 py-12 mobile:h-auto mobile:w-full mobile:flex-none">
        <div className="flex w-full max-w-[448px] grow shrink-0 basis-0 flex-col items-start justify-center gap-12 mobile:h-auto mobile:w-full mobile:max-w-[448px] mobile:flex-none">
          <img
            className="h-24 flex-none object-cover"
            src="https://res.cloudinary.com/subframe/image/upload/v1771493398/uploads/36440/znvfvrhfhlzyaeoslprx.png"
          />
          <div className="flex flex-col items-start justify-center gap-16 pb-32 mobile:px-0 mobile:py-0">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Secure your account
              </span>
              <span className="text-heading-3 font-heading-3 text-subtext-color">
                Verify your identity with the code sent to your email address.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <img
                className="w-20 flex-none grayscale"
                src="https://res.cloudinary.com/subframe/image/upload/v1771493485/uploads/36440/wnzwq0xfe2hcgwhfcskt.png"
              />
              <img
                className="w-20 flex-none grayscale"
                src="https://res.cloudinary.com/subframe/image/upload/v1771493533/uploads/36440/n03yglm2oalp5pclssue.png"
              />
              <img
                className="w-20 flex-none grayscale"
                src="https://res.cloudinary.com/subframe/image/upload/v1771493547/uploads/36440/qjcnoilv3r7kvbxqboar.png"
              />
              <img
                className="w-20 flex-none grayscale"
                src="https://res.cloudinary.com/subframe/image/upload/v1771493558/uploads/36440/oiuptypaguuuammvmun1.png"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex grow shrink-0 basis-0 flex-col items-center justify-center gap-6 self-stretch border-l border-solid border-neutral-border px-12 py-12">
        <div className="flex w-full max-w-[448px] flex-col items-start justify-center gap-8">
          <div className="flex w-full flex-col items-start gap-1">
            <span className="w-full text-heading-2 font-heading-2 text-default-font">
              Enter Verification Code
            </span>
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-body font-body text-subtext-color">
                Need a new code?
              </span>
              <LinkButton
                variant="brand"
                iconRight={<FeatherChevronRight />}
                disabled={countdown > 0}
                onClick={handleResend}
              >
                {countdown > 0 ? `Resend Code (${countdown}s)` : "Resend Code"}
              </LinkButton>
            </div>
          </div>
          <form
            className="flex w-full flex-col items-start justify-center gap-4"
            onSubmit={handleVerify}
          >
            <span className="text-body font-body text-subtext-color">
              Enter the 6-digit verification code that was sent to your email
              address.
            </span>
            <div className="flex w-full items-center gap-2">
              {code.map((digit, index) => (
                <TextField key={index} className="text-center" label="" helpText="">
                  <TextField.Input
                    className="text-center"
                    placeholder={String(index + 1)}
                    value={digit}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      handleCodeChange(index, event.target.value)
                    }
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                      handleKeyDown(index, e)
                    }
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                  />
                </TextField>
              ))}
            </div>
            <Button
              className="h-8 w-full flex-none"
              type="submit"
              disabled={isLoading || !email}
            >
              {isLoading ? "Verifying..." : "Verify code"}
            </Button>
            {!email ? (
              <span className="text-caption font-caption text-error-700">
                Missing email in the URL. Please return to Sign Up.
              </span>
            ) : null}
            {error ? (
              <span className="text-caption font-caption text-error-700">
                {error}
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

export default VerificationPage;
