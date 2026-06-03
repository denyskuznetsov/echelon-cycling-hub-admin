import React from "react";
import {
  BIKE_FITS_PAGE_SIZE,
  loadBikeFitsPage,
  resolveBikeFitsTimeframe,
} from "@/src/lib/bike-fit/data/bike-fits";
import { AllBikeFitsTable } from "./_components/AllBikeFitsTable";

export default async function AllBikeFitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    query?: string;
    timeframe?: string;
  }>;
}) {
  const {
    page: pageParam,
    query: queryParam,
    timeframe: timeframeParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = queryParam ?? "";
  const timeframe = resolveBikeFitsTimeframe(timeframeParam);

  const { bikeFits, count } = await loadBikeFitsPage(page, query, timeframe);
  const totalPages = Math.ceil(count / BIKE_FITS_PAGE_SIZE);

  return (
    <div className="container max-w-none flex w-full flex-col items-start gap-8 bg-default-background pb-12">
      <div className="flex w-full flex-col items-start justify-end relative">
        <div className="flex h-96 w-full flex-none flex-col items-start gap-2 overflow-hidden rounded-md relative">
          <img
            className="min-h-[0px] w-full grow shrink-0 basis-0 object-cover"
            src="https://res.cloudinary.com/subframe/image/upload/v1779455835/uploads/36440/ibwlmjb7jyqjxwl1kidy.jpg"
            alt=""
          />
          <div className="flex items-start absolute inset-0 bg-gradient-to-b from-[rgba(0,47,80,0.3)] to-[rgba(28,70,106,0.8)]" />
        </div>
      </div>
      <AllBikeFitsTable
        bikeFits={bikeFits}
        currentPage={page}
        totalPages={totalPages}
        query={query}
        timeframe={timeframe}
      />
    </div>
  );
}
