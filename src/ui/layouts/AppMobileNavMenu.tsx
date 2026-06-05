"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FeatherMenu } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { DropdownMenu } from "../components/DropdownMenu";
import { Loader } from "../components/Loader";
import { isNavItemSelected, type NavItem } from "./nav-config";

interface AppMobileNavMenuProps {
  items: NavItem[];
  navigate: (href: string) => void;
  isNavigatingTo: (href: string) => boolean;
}

export function AppMobileNavMenu({
  items,
  navigate,
  isNavigatingTo,
}: AppMobileNavMenuProps) {
  const pathname = usePathname();

  if (items.length === 0) {
    return null;
  }

  return (
    <SubframeCore.DropdownMenu.Root>
      <SubframeCore.DropdownMenu.Trigger asChild={true}>
        <button
          type="button"
          aria-label="Open navigation menu"
          className="hidden mobile:inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-default-font hover:bg-brand-100"
        >
          <FeatherMenu className="text-heading-3 font-heading-3" />
        </button>
      </SubframeCore.DropdownMenu.Trigger>
      <SubframeCore.DropdownMenu.Portal>
        <SubframeCore.DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={4}
          asChild={true}
        >
          <DropdownMenu className="z-20">
            {items.map((item) => {
              const isSelected = isNavItemSelected(item, pathname);
              const isNavigating = item.href ? isNavigatingTo(item.href) : false;

              return (
                <DropdownMenu.DropdownItem
                  key={item.label}
                  icon={isNavigating ? <Loader size="small" /> : null}
                  onClick={
                    item.href ? () => navigate(item.href as string) : undefined
                  }
                  className={
                    isSelected || isNavigating ? "bg-brand-100" : undefined
                  }
                >
                  {item.label}
                </DropdownMenu.DropdownItem>
              );
            })}
          </DropdownMenu>
        </SubframeCore.DropdownMenu.Content>
      </SubframeCore.DropdownMenu.Portal>
    </SubframeCore.DropdownMenu.Root>
  );
}
