import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Section,
  Text,
} from "@react-email/components";

interface BikeFitReportEmailProps {
  customerName: string;
  fitDate: string;
  bikeType: string;
}

export default function BikeFitReportEmail({
  customerName,
  fitDate,
  bikeType,
}: BikeFitReportEmailProps) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: "sans-serif",
          backgroundColor: "#f9f9f9",
          padding: "40px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          {/* Logo Section */}
          <Section style={{ textAlign: "center", margin: "16px 0 24px" }}>
            {/* IMPORTANT: Use the exact same public logo URL as the reset password email */}
            <Img
              src="https://iwawhxfptzimluqyebiq.supabase.co/storage/v1/object/sign/echelon-assets/logo%20dots%20orange.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85NDY1OGQzYy00MzM4LTQ2NWYtODk0Yy0zNTZkYjgzYTQ2ZTYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlY2hlbG9uLWFzc2V0cy9sb2dvIGRvdHMgb3JhbmdlLnBuZyIsImlhdCI6MTc3OTE5NjM0MiwiZXhwIjoxODEwNzMyMzQyfQ.xv2xWfI0zvAWudTvzoxC2PLsc74TtGtHMpRH69Pxc5I"
              width="180"
              height="auto"
              alt="Echelon Cycling Hub"
              style={{ margin: "0 auto" }}
            />
          </Section>
          <Heading>Your Bike Fit Report</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            Thank you for visiting Echelon Cycling Hub! Attached to this email is
            the complete PDF report from your {bikeType} bike fit on {fitDate}.
          </Text>
          <Text>
            If you have any questions about your measurements or experience any
            discomfort as you adjust to the new setup, please do not hesitate to
            reach out.
          </Text>
          <Text>Ride safely,</Text>
          <Text>The Echelon Team</Text>
        </Container>
      </Body>
    </Html>
  );
}
