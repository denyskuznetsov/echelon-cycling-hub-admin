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
import { useUser } from "@/src/context/UserContext";
import * as SubframeUtils from "../utils";
import { AppTopbar } from "./AppTopbar";
import { PageScrollArea } from "./NavigationPendingOverlay";
import { getVisibleNavItems } from "./nav-config";
import { useAppNavigation } from "./useAppNavigation";

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
  const { isPending, navigate, isNavigatingTo } = useAppNavigation();
  const { user, profile } = useUser();
  const visibleNavItems = getVisibleNavItems(profile?.role);
  const profileName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const avatarLabel = profileName || user?.email || "U";
  const avatarInitial = avatarLabel.charAt(0).toUpperCase();
  const userEmail = user?.email ?? "No email";

  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-screen w-full flex-col items-center",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <AppTopbar
        navItems={visibleNavItems}
        isPending={isPending}
        navigate={navigate}
        isNavigatingTo={isNavigatingTo}
        userEmail={userEmail}
        avatarInitial={avatarInitial}
      />
      {children ? (
        <PageScrollArea isPending={isPending}>{children}</PageScrollArea>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
