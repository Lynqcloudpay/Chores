"use client";

import { DisputesCenterProvider } from "@/components/DisputesCenterProvider";
import { HouseholdAlertsProvider } from "@/components/HouseholdAlertsProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DisputesCenterProvider>
      <HouseholdAlertsProvider>{children}</HouseholdAlertsProvider>
    </DisputesCenterProvider>
  );
}
