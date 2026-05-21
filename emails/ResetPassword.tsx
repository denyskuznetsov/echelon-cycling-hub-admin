import {
    Html,
    Button,
    Tailwind,
    Text,
    Container,
    Heading,
    Img,
    Section,
    Link,
  } from "@react-email/components";
  import * as React from "react";
  
  export default function ResetPasswordEmail() {
    return (
      <Tailwind>
        <Html>
          <Container className="mx-auto mt-10 max-w-xl rounded-lg border border-solid border-gray-200 bg-white p-8 font-sans shadow-sm">
            
            {/* Logo Section */}
            <Section className="mb-8 mt-4 text-center">
              {/* IMPORTANT: Email images must use absolute, publicly accessible URLs */}
              <Img
                src="https://iwawhxfptzimluqyebiq.supabase.co/storage/v1/object/public/echelon-assets/logo%20dots%20orange.png" 
                width="180"
                height="auto"
                alt="Echelon Cycling Hub"
                className="mx-auto"
              />
            </Section>
  
            {/* Heading */}
            <Heading className="mb-4 text-center text-2xl font-bold text-gray-900">
              Reset Password
            </Heading>
  
            {/* Body Text */}
            <Text className="mb-6 text-center text-base text-gray-700">
              Follow this link to reset the password for your user:
            </Text>
  
            {/* Action Button */}
            <Section className="mb-8 text-center">
              <Button
                href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"
                className="inline-block rounded-md bg-black px-6 py-3 text-center font-semibold text-white"
              >
                Reset Password
              </Button>
            </Section>
  
          </Container>
        </Html>
      </Tailwind>
    );
  }