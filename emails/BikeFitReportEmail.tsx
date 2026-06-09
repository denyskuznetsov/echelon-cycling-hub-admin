import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";

export default function BikeFitReportEmail() {
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
          <Text>
            Thank you for visiting echelon cycling hub for your bike fit and I
            hope you enjoyed the session. Bike fit report is attached.
          </Text>
          <Text>
            Video guide how to transfer numbers is here -{" "}
            <Link href="https://youtu.be/-M55e0utY0Q">
              https://youtu.be/-M55e0utY0Q
            </Link>
          </Text>
          <Text>
            It is essential to verify the fit under real world riding conditions.
            The body will take a couple of rides to adapt to the new position and
            it is normal to experience different muscle usages during this period.
            I recommend that you reduce the duration and intensity of your rides
            while this adaptation process occurs.
          </Text>
          <Text>
            I also recommend that riders have follow up fits every 2-3 years,
            particularly in cases where you&apos;ve lost/gained weight,
            increased/decreased your mileage significantly or there are soft
            tissue restrictions or weakness that is causing incorrect
            neuromuscular mechanics.
          </Text>
          <Text>
            If you have time and will you can leave your review here, it will
            help our shop.
            <br />
            <Link href="https://maps.app.goo.gl/xk1iGa6prWDtCYKn7">
              https://maps.app.goo.gl/xk1iGa6prWDtCYKn7
            </Link>
          </Text>
          <Text>
            Thanks again, enjoy the ride! Any questions, feel free to reach out.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
