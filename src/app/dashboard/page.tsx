"use client";

import React, { useState } from "react";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { TextField } from "@/ui/components/TextField";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { FeatherChevronDown } from "@subframe/core";
import { FeatherCircleDot } from "@subframe/core";
import { FeatherDollarSign } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherKanbanSquare } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherSettings2 } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { KanbanBoard } from "@/src/components/KanbanBoard";

function DashboardPage() {
  const [search, setSearch] = useState("");

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full flex-wrap items-center gap-2 px-6 pt-6 pb-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <FeatherKanbanSquare className="text-heading-2 font-heading-2 text-default-font" />
            <span className="text-heading-2 font-heading-2 text-default-font">
              Echelon Tasks
            </span>
            <Badge>Active</Badge>
          </div>
          <Button
            variant="neutral-primary"
            onClick={() => {}}
          >
            Add new task
          </Button>
        </div>
        <div className="flex w-full flex-wrap items-center gap-6 border-b border-solid border-neutral-border px-6 py-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-6">
            <TextField
              variant="filled"
              label=""
              helpText=""
              icon={<FeatherSearch />}
            >
              <TextField.Input
                placeholder="Search"
                value={search}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(event.target.value)
                }
              />
            </TextField>
          </div>
          <div className="flex flex-wrap items-start gap-1">
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Button
                  variant="neutral-tertiary"
                  iconRight={<FeatherChevronDown />}
                  onClick={() => {}}
                >
                  Filter
                </Button>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    <DropdownMenu.DropdownItem icon={<FeatherPlus />}>
                      Add filter
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Button
                  variant="neutral-tertiary"
                  iconRight={<FeatherChevronDown />}
                  onClick={() => {}}
                >
                  Sort
                </Button>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    <DropdownMenu.DropdownItem icon={<FeatherPlus />}>
                      Add sort
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Button
                  variant="neutral-tertiary"
                  iconRight={<FeatherChevronDown />}
                  onClick={() => {}}
                >
                  Group by
                </Button>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    <DropdownMenu.DropdownItem icon={<FeatherCircleDot />}>
                      Status
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={<FeatherUser />}>
                      Owner
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={<FeatherDollarSign />}>
                      Amount
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
            <Button
              variant="neutral-tertiary"
              icon={<FeatherSettings2 />}
              onClick={() => {}}
            >
              Customize
            </Button>
            <Button
              variant="neutral-tertiary"
              icon={<FeatherDownload />}
              onClick={() => {}}
            >
              Download
            </Button>
          </div>
        </div>
        <KanbanBoard />
      </div>
    </DefaultPageLayout>
  );
}

export default DashboardPage;
