"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherArrowLeft } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";

function VerificationPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
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
                onClick={() => {}}
              >
                Resend code
              </LinkButton>
            </div>
          </div>
          <div className="flex w-full flex-col items-start justify-center gap-4">
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
              onClick={() => {}}
            >
              Verify code
            </Button>
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

export default VerificationPage;
