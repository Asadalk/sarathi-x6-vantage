import type { Metadata } from "next";
import MarketClient from "@/components/MarketClient";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "2035 Market Explorer" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="1"
        deliverable="Deliverable 1 · 2035 market assessment"
        title="Volume lives in the city; margin lives at the airport and on the highway"
        lead="A top-down 2035 sizing anchored on a sourced 2026 market and growth rate, split into six use cases. Segment shares, trip lengths, yields and margins are labelled assumptions; drag the sliders to stress them."
      />
      <MarketClient />
    </>
  );
}
