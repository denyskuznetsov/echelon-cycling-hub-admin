"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Returns a handler that opens the order details drawer by setting the
 * ?order= search param while preserving all other URL state (page, query,
 * timeframe). The server component re-renders the current list page.
 */
export function useOpenOrderDetails() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (orderId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("order", orderId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
}
