"use client";

import { pathToParityLines, type Effort } from "@/lib/vp";

type Props = {
  behindName: string | null;
  deficitVp: number;
  /** Tier VP used for “how many chores” hints. */
  choreVp: Record<Effort, number>;
};

const icons = ["local_laundry_service", "shopping_basket", "cleaning_services", "restaurant"];

export function PathToParity({ behindName, deficitVp, choreVp }: Props) {
  if (!behindName || deficitVp <= 0) return null;
  const lines = pathToParityLines(deficitVp, choreVp);

  return (
    <section className="space-y-2">
      <h2 className="font-headline text-lg font-bold text-on-background">Ways to catch up</h2>
      <p className="text-[13px] text-on-surface-variant">
        Ideas for <span className="font-semibold text-on-surface">{behindName}</span> — rough equivalents, adjust to your week.
      </p>
      <div className="flex flex-col gap-2">
        {lines.slice(0, 4).map((line, i) => (
          <div
            key={line}
            className="flex items-start gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low/60 px-3 py-2.5"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${i % 2 === 0 ? "bg-tertiary-fixed/80 text-on-tertiary-fixed" : "bg-secondary-fixed/90 text-on-secondary-fixed"}`}
            >
              <span className="material-symbols-outlined text-[18px]">{icons[i % icons.length]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-on-surface">{line}</p>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">Money helps too — 1.5 VP per $1.</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
