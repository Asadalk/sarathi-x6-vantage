import type { Metadata } from "next";
import { Suspense } from "react";
import TcoClient from "@/components/tco/TcoClient";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "TCO & Driver Earnings" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="5"
        deliverable="Deliverable 5 · Total cost of ownership"
        title="₹8.7 L lower 5-year TCO, and the driver keeps about ₹1 L more a year"
        lead={
          <>
            Change any input and every output recomputes from the same tested engine. The <strong className="text-ink">Round-1 preset</strong> reproduces our shortlisted numbers. The{" "}
            <strong className="text-ink">Conservative</strong> preset shows what happens when charging is pricier, CNG is cheaper and the battery&apos;s resale value is lower. Copy the URL to share a scenario.
          </>
        }
      />
      <Suspense fallback={<div className="card p-6 text-muted">Loading calculator…</div>}>
        <TcoClient />
      </Suspense>
    </>
  );
}
