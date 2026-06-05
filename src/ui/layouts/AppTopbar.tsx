"use client";

import React from "react";
import { TopbarWithRightNav } from "../components/TopbarWithRightNav";
import { AppMobileNavMenu } from "./AppMobileNavMenu";
import { AppNavLink } from "./AppNavLink";
import { NavigationProgressBar } from "./NavigationPendingOverlay";
import { UserMenu } from "./UserMenu";
import type { NavItem } from "./nav-config";

const LOGO_SRC =
  "https://res.cloudinary.com/subframe/image/upload/v1771493398/uploads/36440/znvfvrhfhlzyaeoslprx.png";

interface AppTopbarProps {
  navItems: NavItem[];
  isPending: boolean;
  navigate: (href: string) => void;
  isNavigatingTo: (href: string) => boolean;
  userEmail: string;
  avatarInitial: string;
}

export function AppTopbar({
  navItems,
  isPending,
  navigate,
  isNavigatingTo,
  userEmail,
  avatarInitial,
}: AppTopbarProps) {
  return (
    <div className="relative w-full">
      <TopbarWithRightNav
        className="mobile:px-4"
        leftSlot={
          <>
            <img className="h-8 flex-none object-cover" src={LOGO_SRC} />
            <div className="flex items-center gap-4 mobile:hidden">
              {navItems.map((item) => (
                <AppNavLink
                  key={item.label}
                  item={item}
                  navigate={navigate}
                  isNavigatingTo={isNavigatingTo}
                />
              ))}
            </div>
            <AppMobileNavMenu
              items={navItems}
              navigate={navigate}
              isNavigatingTo={isNavigatingTo}
            />
          </>
        }
        rightSlot={
          <UserMenu userEmail={userEmail} avatarInitial={avatarInitial} />
        }
      />
      <NavigationProgressBar isPending={isPending} />
    </div>
  );
}
