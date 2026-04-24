"use client";

import React from "react";
import { AreaChart } from "@/ui/components/AreaChart";
import type { PartnerDailyChartPoint } from "./types";

const SALES_DATA = [
  { Year: "2015", "Your Commission": 120, Orders: 110, "Total Order Value": 100 },
  { Year: "2016", "Your Commission": 130, Orders: 95, "Total Order Value": 105 },
  // { Year: "2017", "Your Commission": 115, Orders: 105, "Total Order Value": 110 },
  // { Year: "2018", "Your Commission": 125, Orders: 120, "Total Order Value": 90 },
  // { Year: "2019", "Your Commission": 110, Orders: 130, "Total Order Value": 85 },
  // { Year: "2020", "Your Commission": 135, Orders: 100, "Total Order Value": 95 },
  // { Year: "2021", "Your Commission": 105, Orders: 115, "Total Order Value": 120 },
  // { Year: "2022", "Your Commission": 140, Orders: 125, "Total Order Value": 130 },
];

interface SalesTrendsProps {
  data: PartnerDailyChartPoint[];
}

export function SalesTrends({ data }: SalesTrendsProps) {
  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full items-center gap-2">
        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
          Sales Trends
        </span>
      </div>
      <AreaChart
        categories={["Orders"]}
        data={data.length > 0 ? data : SALES_DATA}
        index={data.length > 0 ? "Date" : "Year"}
      />
    </div>
  );
}
