"use client";

import { useMemo } from "react";
import { contributionGapVp, formatVp, tiltPercent } from "@/lib/vp";

type Props = {
  nameA: string;
  nameB: string;
  vpA: number;
  vpB: number;
};

/**
 * Contribution balance — side-by-side totals + one split meter (no arc / needle metaphor).
 */
export function ContributionGapHero({ nameA, nameB, vpA, vpB }: Props) {
  const sum = vpA + vpB;
  const gap = contributionGapVp(vpA, vpB);
  const tilt = tiltPercent(vpA, vpB);
  const balanced = sum > 0 && gap < 0.01;
  const leader = vpA > vpB ? nameA : vpB > vpA ? nameB : null;
  const behind = vpA < vpB ? nameA : vpB < vpA ? nameB : null;

  const pctA = useMemo(() => {
    if (sum <= 0) return 50;
    return (vpA / sum) * 100;
  }, [vpA, sum]);

  return (
    <section className="contribution-hero-in relative overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-[0_8px_32px_-8px_rgba(25,28,29,0.12)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-secondary-container/10 blur-3xl" />

      <div className="relative px-4 pb-5 pt-4">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Contribution balance · running total
        </p>

        {/* Two-column scoreboard — clear numbers, no gauge */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-outline-variant/10 bg-surface-bright/50 p-3 dark:bg-white/[0.03]">
          <div className="min-w-0 border-r border-outline-variant/15 pr-2 text-center sm:pr-3">
            <p className="truncate text-[11px] font-semibold text-primary">{nameA}</p>
            <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums tracking-tight text-on-background">
              {sum > 0 ? formatVp(vpA) : "—"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-on-surface-variant">{sum > 0 ? `${pctA.toFixed(0)}% of total` : "No VP yet"}</p>
          </div>
          <div className="min-w-0 pl-2 text-center sm:pl-3">
            <p className="truncate text-[11px] font-semibold text-blue-800 dark:text-blue-200">{nameB}</p>
            <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums tracking-tight text-on-background">
              {sum > 0 ? formatVp(vpB) : "—"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-on-surface-variant">
              {sum > 0 ? `${(100 - pctA).toFixed(0)}% of total` : "No VP yet"}
            </p>
          </div>
        </div>

        {/* Single horizontal meter */}
        <div className="mt-4">
          <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/90">
            Share of total VP
          </p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-high shadow-inner ring-1 ring-black/[0.04] dark:ring-white/10">
            {sum <= 0 ? (
              <div className="h-full w-full bg-gradient-to-r from-surface-container-high to-surface-container-highest" />
            ) : (
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${pctA}%` }}
                />
                <div
                  className="h-full bg-secondary-container transition-[width] duration-500 ease-out"
                  style={{ width: `${100 - pctA}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          {balanced && sum > 0 ? (
            <>
              <p className="font-headline text-2xl font-extrabold tracking-tight text-primary">Balanced</p>
              <p className="mt-1 text-xs leading-snug text-on-surface-variant">
                Same running VP — nice work, {nameA} & {nameB}.
              </p>
            </>
          ) : sum <= 0 ? (
            <>
              <p className="font-headline text-2xl font-extrabold text-on-surface-variant">Start together</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Tap the center <span className="font-bold text-primary">+</span> below to log contributions.
              </p>
            </>
          ) : (
            <>
              <p className="font-headline text-3xl font-extrabold tabular-nums tracking-tight text-on-background">
                {formatVp(gap)} <span className="text-lg font-bold text-on-surface-variant">VP gap</span>
              </p>
              <p className="mt-1.5 text-sm leading-snug text-on-surface-variant">
                <span className="font-semibold text-on-surface">{leader}</span> is ahead · the balance leans{" "}
                <span className="font-bold tabular-nums text-tertiary">{tilt}%</span> their way.
              </p>
              {behind ? (
                <p className="mt-2 rounded-xl bg-tertiary-fixed/25 px-3 py-2 text-xs leading-relaxed text-on-surface">
                  <span className="font-semibold text-on-surface">{behind}</span> needs about{" "}
                  <span className="font-bold text-primary">{formatVp(gap)} VP</span> to catch up.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
