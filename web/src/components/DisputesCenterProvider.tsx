"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DisputesCenterModal } from "@/components/DisputesCenterModal";

type Ctx = {
  openDisputesCenter: () => void;
  disputesCenterOpen: boolean;
};

const DisputesCenterContext = createContext<Ctx | null>(null);

export function DisputesCenterProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDisputesCenter = useCallback(() => setOpen(true), []);
  const value = useMemo(
    () => ({ openDisputesCenter, disputesCenterOpen: open }),
    [open, openDisputesCenter],
  );
  return (
    <DisputesCenterContext.Provider value={value}>
      {children}
      <DisputesCenterModal open={open} onClose={() => setOpen(false)} />
    </DisputesCenterContext.Provider>
  );
}

export function useDisputesCenter() {
  const v = useContext(DisputesCenterContext);
  if (!v) throw new Error("useDisputesCenter must be used within DisputesCenterProvider");
  return v;
}
