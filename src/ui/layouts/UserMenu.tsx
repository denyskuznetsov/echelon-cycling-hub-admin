"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FeatherLogOut } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { createClient } from "@/src/utils/supabase/client";
import { Avatar } from "../components/Avatar";
import { DropdownMenu } from "../components/DropdownMenu";
import { TopbarWithRightNav } from "../components/TopbarWithRightNav";

interface UserMenuProps {
  userEmail: string;
  avatarInitial: string;
}

export function UserMenu({ userEmail, avatarInitial }: UserMenuProps) {
  const router = useRouter();

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
    <div className="flex items-center gap-2">
      <TopbarWithRightNav.NavItem className="max-w-64 cursor-default hover:bg-transparent mobile:hidden">
        <span className="truncate">{userEmail}</span>
      </TopbarWithRightNav.NavItem>
      <SubframeCore.DropdownMenu.Root>
        <SubframeCore.DropdownMenu.Trigger asChild={true}>
          <Avatar className="cursor-pointer">
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
  );
}
