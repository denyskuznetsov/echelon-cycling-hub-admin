import React from "react";
import { createClient } from "@/src/utils/supabase/server";
import { DataLoadError } from "@/src/components/DataLoadError";
import {
  PartnersTable,
  type PartnerListRow,
} from "./_components/PartnersTable";

export default async function AllPartnersPage() {
  const supabase = await createClient();
  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, name, slug, location")
    .order("name", { ascending: true });

  if (error) {
    console.error("AllPartnersPage:", error);
  }

  const rows: PartnerListRow[] = (partners as PartnerListRow[] | null) ?? [];

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background py-12">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          All Partners
        </span>
        <span className="text-body font-body text-subtext-color">
          Admin view - choose a partner to inspect their dashboard.
        </span>
      </div>

      {error ? (
        <DataLoadError title="Couldn't load partners" message={error.message} />
      ) : null}

      <div className="flex w-full flex-col items-start gap-6">
        <PartnersTable rows={rows} />
      </div>
    </div>
  );
}
