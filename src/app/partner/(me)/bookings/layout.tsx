import React, { Suspense } from "react";
import { OrderDetailsDrawerHost } from "@/src/components/orders/OrderDetailsDrawerHost";

export default function PartnerMeBookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <OrderDetailsDrawerHost />
      </Suspense>
      {children}
    </>
  );
}
