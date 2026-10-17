import type { Metadata } from "next";
import RoadmapClient from "@/components/RoadmapClient";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Roadmap 2027–35" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="7"
        deliverable="Deliverable 7 · Implementation roadmap"
        title="Pilot 2027 → Localise 2030 → Scale 2033: a realistic path across India"
        lead="Each phase has a gate. We move on only when the previous phase proves its economics on real fleets. Partner types are described generically: we do not claim any agreement that does not exist. Fleet sizes and localisation percentages are planning targets."
      />
      <RoadmapClient />
    </>
  );
}
