"use client";
// @subframe/sync-disable
/*
 * Documentation:
 * Avatar — https://app.subframe.com/ee500777c863/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 * Default Page Layout — https://app.subframe.com/ee500777c863/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 * Dropdown Menu — https://app.subframe.com/ee500777c863/library?component=Dropdown+Menu_99951515-459b-4286-919e-a89e7549b43b
 * Topbar with right nav — https://app.subframe.com/ee500777c863/library?component=Topbar+with+right+nav_d20e2e52-ba3d-4133-901a-9a15f7f729a9
 */

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { FeatherLogOut } from "@subframe/core";
import { FeatherSettings } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { createClient } from "@/src/utils/supabase/client";
import { useUser, type UserRole } from "@/src/context/UserContext";
import { Avatar } from "../components/Avatar";
import { DropdownMenu } from "../components/DropdownMenu";
import { TopbarWithRightNav } from "../components/TopbarWithRightNav";
import * as SubframeUtils from "../utils";

const NAV_ITEMS: {
  label: string;
  roles: UserRole[];
  href?: string;
}[] = [
  { label: "Partners", roles: ["admin", "manager"], href: "/all-partners" },
  { label: "Orders", roles: ["admin", "manager"] },
  { label: "Customers", roles: ["admin", "manager"] },
  {
    label: "Task Management",
    roles: ["admin", "manager", "mechanic"],
    href: "/workshop",
  },
];

interface DefaultPageLayoutRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const DefaultPageLayoutRoot = React.forwardRef<
  HTMLDivElement,
  DefaultPageLayoutRootProps
>(function DefaultPageLayoutRoot(
  { children, className, ...otherProps }: DefaultPageLayoutRootProps,
  ref
) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile } = useUser();
  const role = profile?.role;
  const visibleNavItems = role
    ? NAV_ITEMS.filter((item) => item.roles.includes(role))
    : [];
  const profileName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const avatarLabel = profileName || user?.email || "U";
  const avatarInitial = avatarLabel.charAt(0).toUpperCase();
  const userEmail = user?.email ?? "No email";
  const isPartnersRoute =
    pathname === "/partner" ||
    pathname?.startsWith("/partner/") ||
    pathname?.startsWith("/all-partners");

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-screen w-full flex-col items-center",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <TopbarWithRightNav
        leftSlot={
          <>
            <img
              className="h-8 flex-none object-cover"
              src="https://res.cloudinary.com/subframe/image/upload/v1771493398/uploads/36440/znvfvrhfhlzyaeoslprx.png"
            />
            {visibleNavItems.map((item) => (
              <TopbarWithRightNav.NavItem
                key={item.label}
                selected={
                  item.label === "Partners"
                    ? isPartnersRoute
                    : !!item.href && pathname?.startsWith(item.href)
                }
                onClick={
                  item.href ? () => router.push(item.href as string) : undefined
                }
              >
                {item.label}
              </TopbarWithRightNav.NavItem>
            ))}
          </>
        }
        rightSlot={
          <div className="flex items-center gap-2">
            <TopbarWithRightNav.NavItem className="max-w-64 cursor-default hover:bg-transparent">
              <span className="truncate">{userEmail}</span>
            </TopbarWithRightNav.NavItem>
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Avatar>
                  <span className="font-body-bold">{avatarInitial}</span>
                </Avatar>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu className="z-20">
                    {/* <DropdownMenu.DropdownItem icon={<FeatherUser />}>
                      Profile
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={<FeatherSettings />}>
                      Settings
                    </DropdownMenu.DropdownItem> */}
                    <DropdownMenu.DropdownItem
                      icon={<FeatherLogOut />}
                      onClick={handleLogout}
                    >
                      Log out
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
          </div>
        }
      />
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto bg-default-background">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
