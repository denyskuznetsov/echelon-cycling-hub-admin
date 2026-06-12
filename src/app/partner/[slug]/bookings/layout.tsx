import React, { Suspense } from "react";
import { OrderDetailsDrawerHost } from "@/src/components/orders/OrderDetailsDrawerHost";

export default function PartnerSlugBookingsLayout({
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
