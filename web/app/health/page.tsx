import type { Metadata } from "next";
import HealthClient from "@/components/HealthClient";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Battery & Predictive Maintenance" };

export default function Page() {
  return (
    <>
      <PageHeader
        step="6"
        deliverable="Deliverable 6 · Fleet & battery management, predictive maintenance"
        title="Catch a failing pack or brake before it takes a car off the road"
        lead="Ninety days of synthetic daily telematics for a 50-car fleet: state of health, cell temperature spread, cell voltage imbalance, DC fast-charge count and a brake-wear index. An IsolationForest trained in model/train_models.py flags outliers, a robust z-score names the reason, and VANTAGE books the fix into an off-peak slot. This page demonstrates the method; the data is not real."
      />
      <HealthClient />
    </>
  );
}
