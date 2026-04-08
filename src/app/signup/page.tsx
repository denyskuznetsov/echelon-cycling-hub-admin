"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/utils/supabase/client";
import { validatePassword } from "@/src/utils/validation";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { FeatherBuilding } from "@subframe/core";
import { FeatherCheck } from "@subframe/core";
import { FeatherChevronRight } from "@subframe/core";
import { FeatherLock } from "@subframe/core";
import { FeatherMail } from "@subframe/core";

function SignUpPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedPassword = password.trim();
    const { isValid, errorMessage: passwordErrorMessage } = validatePassword(
      trimmedPassword
    );

    if (!isValid) {
      setErrorMessage(passwordErrorMessage);
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: trimmedPassword,
        options: {
          data: {
            company: company.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push(`/verification?email=${encodeURIComponent(email.trim())}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error while signing up."
      );
    } finally {
      setIsLoading(false);
    }
  };

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
              Get started today
            </span>
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-body font-body text-subtext-color">
                Already have an account?
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
            onSubmit={handleSignUp}
          >
            <TextField
              className="h-auto w-full flex-none"
              label=""
              helpText=""
              icon={<FeatherBuilding />}
            >
              <TextField.Input
                placeholder="Company"
                value={company}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setCompany(event.target.value)
                }
              />
            </TextField>
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
            <div className="flex w-full flex-wrap items-start gap-2 px-2 py-2 mobile:flex-col mobile:flex-wrap mobile:gap-2">
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Signing up..." : "Sign up"}
            </Button>
            {errorMessage ? (
              <span className="text-caption font-caption text-error-700">
                {errorMessage}
              </span>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
