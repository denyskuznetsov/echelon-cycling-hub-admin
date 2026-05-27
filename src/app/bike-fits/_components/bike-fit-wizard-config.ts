export type BikeFitStepKey =
  | "customer"
  | "old-bike"
  | "physical-assessment"
  | "new-bike-fit-data";

export const BIKE_FIT_STEPS: { key: BikeFitStepKey; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "old-bike", label: "Old Bike" },
  { key: "physical-assessment", label: "Physical Assessment" },
  { key: "new-bike-fit-data", label: "New Bike Fit Data" },
];
