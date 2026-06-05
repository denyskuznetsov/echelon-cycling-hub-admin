"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopbarWithRightNav } from "../components/TopbarWithRightNav";
import { isNavItemSelected, type NavItem } from "./nav-config";

interface AppNavLinkProps {
  item: NavItem;
  navigate: (href: string) => void;
  isNavigatingTo: (href: string) => boolean;
}

export function AppNavLink({
  item,
  navigate,
  isNavigatingTo,
}: AppNavLinkProps) {
  const pathname = usePathname();
  const isSelected = isNavItemSelected(item, pathname);

  if (!item.href) {
    return (
      <TopbarWithRightNav.NavItem selected={isSelected}>
        {item.label}
      </TopbarWithRightNav.NavItem>
    );
  }

  const isNavigating = isNavigatingTo(item.href);

  return (
    <Link
      href={item.href}
      prefetch
      onClick={(event) => {
        event.preventDefault();
        navigate(item.href as string);
      }}
      className="no-underline"
      aria-current={isSelected ? "page" : undefined}
    >
      <TopbarWithRightNav.NavItem
        selected={isSelected || isNavigating}
        className={isNavigating ? "pointer-events-none opacity-80" : undefined}
      >
        <span className="inline-flex items-center gap-1.5">
          {item.label}
        </span>
      </TopbarWithRightNav.NavItem>
    </Link>
  );
}
