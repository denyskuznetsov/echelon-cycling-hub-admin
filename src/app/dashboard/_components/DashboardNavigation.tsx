"use client";

import React, { createContext, useContext, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import DashboardLoading from "../loading";

const NavigationContext = createContext<((href: string) => void) | null>(null);

/** Keep the server header and all workload sections inside the same pending surface. */
export function DashboardNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const loadingRef = useRef<HTMLDivElement>(null);
  const movedFocus = useRef(false);
  useEffect(() => {
    if (pending) {
      loadingRef.current?.focus();
      movedFocus.current = true;
    } else if (movedFocus.current) {
      document.querySelector<HTMLElement>("main h1")?.focus();
      movedFocus.current = false;
    }
  }, [pending]);
  return <NavigationContext.Provider value={(href) => startTransition(() => router.push(href))}>
    {pending ? <div ref={loadingRef} tabIndex={-1} aria-label="Loading daily briefing"><DashboardLoading /></div> : null}
    <div hidden={pending}>{children}</div>
  </NavigationContext.Provider>;
}

export function useDashboardNavigation() {
  const navigate = useContext(NavigationContext);
  if (!navigate) throw new Error("Dashboard navigation requires DashboardNavigation.");
  return navigate;
}
