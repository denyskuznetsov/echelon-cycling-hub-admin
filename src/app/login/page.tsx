"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherChevronRight } from "@subframe/core";
import { FeatherLock } from "@subframe/core";
import { FeatherMail } from "@subframe/core";

function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex h-full w-full flex-wrap items-start bg-default-background mobile:flex-col mobile:flex-wrap mobile:gap-0">
      <div className="flex max-w-[576px] grow shrink-0 basis-0 flex-col items-center gap-12 self-stretch bg-neutral-50 px-12 py-12 mobile:h-auto mobile:w-full mobile:flex-none">
        <div className="flex w-full max-w-[448px] grow shrink-0 basis-0 flex-col items-start justify-center gap-12 mobile:h-auto mobile:w-full mobile:max-w-[448px] mobile:flex-none">
          <img
            className="h-24 flex-none object-cover"
            src="https://res.cloudinary.com/subframe/image/upload/v1771493398/uploads/36440/znvfvrhfhlzyaeoslprx.png"
          />
          <div className="flex flex-col items-start justify-center gap-16 pb-32 mobile:px-0 mobile:py-0">
            <div className="flex flex-col items-start gap-2">
              <span className="text-heading-2 font-heading-2 text-default-font">
                A better product is waiting{" "}
              </span>
              <span className="text-heading-3 font-heading-3 text-subtext-color">
                Save effort, time, and money by joining hundreds of leading
                brands.
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
              Welcome back
            </span>
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-body font-body text-subtext-color">
                Don&#39;t have an account?
              </span>
              <LinkButton
                variant="brand"
                iconRight={<FeatherChevronRight />}
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </LinkButton>
            </div>
          </div>
          <div className="flex w-full flex-col items-start justify-center gap-4">
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
            <TextField
              className="h-auto w-full flex-none"
              label=""
              helpText=""
              icon={<FeatherLock />}
            >
              <TextField.Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(event.target.value)
                }
              />
            </TextField>
            <div className="flex w-full items-center justify-end">
              <LinkButton
                variant="brand"
                size="small"
                onClick={() => router.push("/forgot-password")}
              >
                Forgot password?
              </LinkButton>
            </div>
            <Button
              className="h-8 w-full flex-none"
              onClick={() => {}}
            >
              Sign in
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
