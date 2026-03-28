import type { ContributionRow } from "@/types/db";

/** Older rows may omit status before migration. */
export function isApproved(r: Pick<ContributionRow, "status">): boolean {
  return (r.status ?? "approved") === "approved";
}

export function isPending(r: Pick<ContributionRow, "status">): boolean {
  return (r.status ?? "approved") === "pending";
}

/** Open dispute: VP frozen for this entry until resolved. */
export function isDisputeOpen(r: Pick<ContributionRow, "dispute_status">): boolean {
  return r.dispute_status === "open";
}

/** Approved rows that count toward weekly VP (excludes open disputes). */
export function countsTowardVp(r: ContributionRow): boolean {
  if (!isApproved(r)) return false;
  if (isDisputeOpen(r)) return false;
  return true;
}
