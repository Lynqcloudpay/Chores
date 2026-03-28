import type { ContributionRow } from "@/types/db";

/** Older rows may omit status before migration. */
export function isApproved(r: Pick<ContributionRow, "status">): boolean {
  return (r.status ?? "approved") === "approved";
}

export function isPending(r: Pick<ContributionRow, "status">): boolean {
  return (r.status ?? "approved") === "pending";
}
