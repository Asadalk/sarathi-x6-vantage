import type { Metadata } from "next";
import VehicleClient from "@/components/VehicleClient";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Concept & Specs" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="2"
        deliverable="Deliverables 2 & 4 · Vehicle concept & technical specifications"
        title="A 6+1 compact MPV is the one body that serves both revenue pools"
        lead="A footprint close to a compact SUV, a high roof for easy entry and exit, three rows that reconfigure between six seats, pooled rides and airport-with-luggage, and a battery sized for one urban shift rather than a brochure range figure. The specs below are concept targets, checked by the same tested physics functions used everywhere else."
      />
      <VehicleClient />
    </>
  );
}
