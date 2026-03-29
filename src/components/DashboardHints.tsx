"use client";

import Link from "next/link";

type Props = {
  hasPartner: boolean;
  chorePresetsOnboarded: boolean;
};

/** Single soft notice area — avoids a stack of separate bordered boxes. */
export function DashboardHints({ hasPartner, chorePresetsOnboarded }: Props) {
  if (hasPartner && chorePresetsOnboarded) return null;

  return (
    <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-low/60 px-3 py-3 text-[13px] leading-snug text-on-surface">
      {!hasPartner ? (
        <p>
          <span className="font-semibold text-on-surface">Partner:</span> share the invite code so they can join and approve{" "}
          <strong className="text-on-surface">custom</strong> chore efforts.
        </p>
      ) : null}
      {!chorePresetsOnboarded ? (
        <p className={!hasPartner ? "mt-2 border-t border-outline-variant/15 pt-2.5" : ""}>
          <span className="font-semibold text-on-surface">Chore list:</span>{" "}
          <Link href="/setup/chores" className="font-semibold text-primary underline underline-offset-2">
            Set up chores
          </Link>{" "}
          so presets match how you both think about effort.
        </p>
      ) : null}
    </div>
  );
}
