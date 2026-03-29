"use client";

import { DisputesCenterProvider } from "@/components/DisputesCenterProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DisputesCenterProvider>{children}</DisputesCenterProvider>;
}
