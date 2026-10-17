import type { Metadata } from "next";
import VantageLoader from "@/components/vantage/VantageLoader";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Live Fleet Simulator" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="6"
        deliverable="Deliverable 6 · AI & connected ecosystem"
        title="VANTAGE turns idle time into paid kilometres"
        lead={
          <>
            A deterministic, seeded simulation: 50 SARATHI-X6 cars, one stylised city with an airport about 22 km out and a highway exit, 24 hours in 5-minute steps. Both fleets get the <em>same</em> requests.{" "}
            <strong className="text-ink">Naive</strong> sends the nearest car, charges whenever SOC drops below 30% and cruises when idle. <strong className="text-ink">VANTAGE</strong> dispatches with SOC in mind, defers charging through peaks, queues at the airport rank against forecast arrivals, and repositions cars to where forecast demand per idle car is highest.
          </>
        }
      />
      <VantageLoader />
    </>
  );
}
