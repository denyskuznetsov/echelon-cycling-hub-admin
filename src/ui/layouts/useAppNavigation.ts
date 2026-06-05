"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { routeMatchesHref } from "./nav-config";

export function useAppNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (pendingHref && routeMatchesHref(pathname, pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  const navigate = useCallback(
    (href: string) => {
      if (routeMatchesHref(pathname, href)) return;
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router],
  );

  const isNavigatingTo = useCallback(
    (href: string) => isPending && pendingHref === href,
    [isPending, pendingHref],
  );

  return { isPending, navigate, isNavigatingTo };
}
