"use client";

import { mergedChorePresets, type Effort } from "@/lib/vp";

const EFFORT_ORDER: Effort[] = ["low", "medium", "high"];

type Props = {
  /** Effective VP for this home’s low/medium/high tiers. */
  choreVp: Record<Effort, number>;
  householdExtraPresets: Record<Effort, string[]>;
  /** Same as contribution modal — after household chore onboarding, only household rows per tier. */
  includeGlobalPresets: boolean;
};

export function ChoreLegend({ choreVp, householdExtraPresets, includeGlobalPresets }: Props) {
  return (
    <section
      aria-labelledby="chore-legend-title"
      className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/60 p-5"
    >
      <h2
        id="chore-legend-title"
        className="font-headline text-base font-bold text-on-surface"
      >
        Chore value legend
      </h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        Each chore earns the VP for its effort tier — including your setup list, approved custom chores, and any
        custom entries still waiting for partner approval
        {includeGlobalPresets ? " (plus default suggestions)." : "."}
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        {EFFORT_ORDER.map((effort) => {
          const labels = mergedChorePresets(effort, householdExtraPresets[effort], {
            includeGlobalPresets,
          });
          return (
            <div key={effort}>
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-outline-variant/10 pb-2">
                <span className="font-headline text-sm font-bold capitalize text-on-surface">{effort}</span>
                <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-extrabold text-primary">
                  {choreVp[effort]} VP
                </span>
              </div>
              {labels.length === 0 ? (
                <p className="text-sm italic text-on-surface-variant/80">No chores in this tier yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-on-surface">
                  {labels.map((label) => (
                    <li key={`${effort}-${label}`} className="leading-snug">
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
