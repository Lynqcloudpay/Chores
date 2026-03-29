"use client";

/** Placeholder while household data loads — keeps layout stable and feels faster than a single line of text. */
export function DashboardWeekSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-40 rounded-3xl border border-outline-variant/10 bg-surface-container-low/70" />
      <div className="h-20 rounded-2xl bg-surface-container-high/80" />
      <div className="h-36 rounded-2xl bg-surface-container-high/60" />
    </div>
  );
}
