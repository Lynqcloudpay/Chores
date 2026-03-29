import type { Household } from "@/types/db";

/** Pro if tier is pro, or still within a grace window after cancel. */
export function isProHousehold(h: Household | null | undefined): boolean {
  if (!h) return false;
  if (h.subscription_tier === "pro") return true;
  if (h.pro_access_until) {
    const t = Date.parse(h.pro_access_until);
    if (!Number.isNaN(t) && t > Date.now()) return true;
  }
  return false;
}
