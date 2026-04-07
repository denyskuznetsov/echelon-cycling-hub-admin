"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherArrowLeft } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";
import { FeatherMail } from "@subframe/core";

function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

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
                Reset your password and regain access to your account in
                minutes.
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
              onClick={() => {}}
            >
              Send reset link
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

export default ForgotPasswordPage;
