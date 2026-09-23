"use client";

import React, { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import DashboardLoading from "../loading";

const NavigationContext = createContext<((href: string) => void) | null>(null);

/** Keep the server header and all workload sections inside the same pending surface. */
export function DashboardNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <NavigationContext.Provider value={(href) => startTransition(() => router.push(href))}>
    {pending ? <DashboardLoading /> : null}
    <div hidden={pending}>{children}</div>
  </NavigationContext.Provider>;
}

export function useDashboardNavigation() {
  const navigate = useContext(NavigationContext);
  if (!navigate) throw new Error("Dashboard navigation requires DashboardNavigation.");
  return navigate;
}
