"use client";

type Props = {
  nameA: string;
  nameB: string;
  vpA: number;
  vpB: number;
};

export function BalanceScale({ nameA, nameB, vpA, vpB }: Props) {
  const sum = vpA + vpB;
  const pctA = sum > 0 ? Math.round((vpA / sum) * 100) : 50;
  const pctB = sum > 0 ? Math.round((vpB / sum) * 100) : 50;
  const widthA = sum > 0 ? (vpA / sum) * 100 : 50;
  const widthB = sum > 0 ? (vpB / sum) * 100 : 50;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-headline text-2xl font-bold text-on-background">VP Distribution</h2>
        <span className="font-label text-sm uppercase tracking-wider text-on-surface-variant">
          Weekly View
        </span>
      </div>
      <div className="space-y-8 rounded-3xl bg-surface-container-lowest p-8 bento-shadow">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-headline text-xl font-extrabold text-primary">{nameA}</span>
            <span className="text-xs font-medium text-on-surface-variant">
              {vpA.toFixed(0)} VP ({pctA}%)
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="font-headline text-xl font-extrabold text-secondary">{nameB}</span>
            <span className="text-xs font-medium text-on-surface-variant">
              {vpB.toFixed(0)} VP ({pctB}%)
            </span>
          </div>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary-container"
            style={{ width: `${widthA}%` }}
          >
            <div className="absolute right-0 top-0 h-full w-1 bg-surface-container-lowest/30 blur-[2px]" />
          </div>
          <div
            className="absolute right-0 top-0 h-full bg-secondary-container"
            style={{ width: `${widthB}%` }}
          />
        </div>
        <p className="text-center text-sm italic text-on-surface-variant">
          {sum <= 0
            ? "Log contributions this week to see the split."
            : Math.abs(vpA - vpB) < 0.01
              ? "Parity achieved — equal contribution so far."
              : `Gap: ${Math.abs(vpA - vpB).toFixed(1)} VP between partners.`}
        </p>
      </div>
    </section>
  );
}
