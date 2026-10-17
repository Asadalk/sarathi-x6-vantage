import type { Metadata } from "next";
import PowertrainClient from "@/components/PowertrainClient";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Powertrain Selector" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="3"
        deliverable="Deliverable 3 · Powertrain & energy strategy"
        title="EV where demand is dense, range-extension where uptime is the constraint"
        lead="Six powertrains scored on 5-year ₹/km, productive uptime, charging and refuelling readiness, well-to-wheel CO₂ and upfront price. Move the duty mix and the weights to see where each option wins. Pure BEV wins in dense city-only duty, CNG wins on upfront price, and the SARATHI EREV wins for a mixed intra-city and inter-city fleet."
      />
      <PowertrainClient />
    </>
  );
}
