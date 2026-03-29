"use client";

import { contributionGapVp, formatVp, tiltPercent } from "@/lib/vp";

type Props = {
  nameA: string;
  nameB: string;
  vpA: number;
  vpB: number;
};

export function EquitySummary({ nameA, nameB, vpA, vpB }: Props) {
  const gap = contributionGapVp(vpA, vpB);
  const tilt = tiltPercent(vpA, vpB);
  const sum = vpA + vpB;
  const balanced = sum === 0 || gap < 0.01;
  const leader = vpA > vpB ? nameA : vpB > vpA ? nameB : null;
  const behind = vpA < vpB ? nameA : vpB < vpA ? nameB : null;

  if (balanced) {
    return (
      <section>
        <div className="flex flex-col items-center space-y-4 rounded-3xl border border-primary-container/20 bg-primary-container/10 p-8 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Current Balance</span>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-background">
            In Balance
          </h1>
          <p className="max-w-[280px] text-base leading-relaxed text-on-surface-variant">
            Great work! Contribution levels between {nameA} and {nameB} are aligned this week.
          </p>
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2 text-sm font-bold text-on-primary-container">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Maintain the Flow
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col items-center space-y-4 rounded-3xl border border-tertiary-container/30 bg-tertiary-fixed/20 p-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-tertiary">Contribution gap</span>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-background">
          {formatVp(gap)} VP apart
        </h1>
        <p className="max-w-[320px] text-base leading-relaxed text-on-surface-variant">
          The scale is tipped {tilt}% toward {leader}.
          {behind ? (
            <>
              {" "}
              <span className="font-semibold text-primary">
                {behind} needs about {formatVp(gap)} VP to reach parity with {leader}.
              </span>
            </>
          ) : null}
        </p>
      </div>
    </section>
  );
}
