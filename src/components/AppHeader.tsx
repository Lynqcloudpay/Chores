"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useHouseholdAlerts } from "@/components/HouseholdAlertsProvider";
import type { ContributionRow, DelegationRequestRow } from "@/types/db";

type Props = {
  displayName?: string;
  /** Optional — small help control opens rules modal from dashboard */
  onHelp?: () => void;
};

function summarizeContribution(r: ContributionRow): string {
  if (r.kind === "provision" && r.amount_cents != null) {
    return `Financial · $${(r.amount_cents / 100).toFixed(2)}`;
  }
  const note = r.note?.trim();
  if (r.kind === "chore" && r.effort) {
    return note ? `${note} · ${r.effort}` : `${r.effort} chore`;
  }
  return "Entry";
}

export function AppHeader({ displayName, onHelp }: Props) {
  const initial = displayName?.trim()?.[0]?.toUpperCase() ?? "?";
  const alerts = useHouseholdAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const actionNeeded =
    (alerts?.incomingDelegations.length ?? 0) +
    (alerts?.pendingTheirReview.length ?? 0);
  const waitingOnPartner =
    (alerts?.outgoingDelegations.length ?? 0) + (alerts?.pendingYourReview.length ?? 0);
  const total = actionNeeded + waitingOnPartner;
  const partner = alerts?.partnerName ?? "Partner";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-outline-variant/10 bg-surface/90 backdrop-blur-md dark:bg-gray-900/85">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest text-sm font-bold text-on-surface">
            {initial}
          </div>
          <span className="font-headline text-base font-extrabold italic tracking-tight text-on-surface dark:text-white">
            Equity Engine
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onHelp ? (
            <button
              type="button"
              onClick={onHelp}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/25 bg-surface-container-lowest text-base font-bold text-primary shadow-sm transition hover:bg-surface-container-high active:scale-95"
              aria-label="How it works"
              title="How it works"
            >
              ?
            </button>
          ) : null}

          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={`Notifications${total > 0 ? `, ${total} items need attention` : ""}`}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition active:scale-95 ${
                actionNeeded > 0
                  ? "animate-pulse border-red-400/80 bg-red-500/15 text-red-700 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-200"
                  : total > 0
                    ? "border-amber-400/70 bg-amber-500/15 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-100"
                    : "border-outline-variant/25 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{
                  fontVariationSettings:
                    total > 0 ? "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                notifications
              </span>
              {total > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold leading-none text-white shadow ring-2 ring-surface dark:ring-gray-900">
                  {total > 9 ? "9+" : total}
                </span>
              ) : null}
            </button>

            {open ? (
              <div
                role="dialog"
                aria-label="Household alerts"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[min(100vw-1.5rem,22rem)] rounded-2xl border border-outline-variant/20 bg-surface-container-lowest py-2 shadow-2xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10"
              >
                <div className="border-b border-outline-variant/15 px-4 py-2.5">
                  <p className="font-headline text-sm font-bold text-on-surface">Alerts</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Partner tasks &amp; approvals — same as Home, always visible here.
                  </p>
                </div>

                {alerts?.loading ? (
                  <p className="px-4 py-6 text-sm text-on-surface-variant">Loading…</p>
                ) : total === 0 ? (
                  <p className="px-4 py-6 text-sm text-on-surface-variant">Nothing pending. You&apos;re all caught up.</p>
                ) : (
                  <div className="max-h-[min(70dvh,420px)] overflow-y-auto overscroll-contain">
                    {actionNeeded > 0 ? (
                      <div className="border-b border-red-500/15 bg-red-500/[0.06] px-3 py-2 dark:bg-red-950/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                          Needs you
                        </p>
                        <ul className="mt-2 space-y-2">
                          {alerts!.incomingDelegations.map((d: DelegationRequestRow) => (
                            <li key={d.id} className="rounded-xl bg-surface-container-low/80 px-3 py-2 text-sm dark:bg-black/20">
                              <p className="font-semibold text-on-surface">Partner ask: {d.chore_label}</p>
                              <p className="text-xs text-on-surface-variant">
                                {d.effort} · submit photo proof on Home
                              </p>
                            </li>
                          ))}
                          {alerts!.pendingTheirReview.map((r: ContributionRow) => (
                            <li key={r.id} className="rounded-xl bg-surface-container-low/80 px-3 py-2 text-sm dark:bg-black/20">
                              <p className="font-semibold text-on-surface">Approve: {summarizeContribution(r)}</p>
                              <p className="text-xs text-on-surface-variant">
                                Waiting on you · open Approvals on Home or Logs
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {waitingOnPartner > 0 ? (
                      <div className="px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200/90">
                          Waiting on {partner}
                        </p>
                        <ul className="mt-2 space-y-2">
                          {alerts!.outgoingDelegations.map((d: DelegationRequestRow) => (
                            <li key={d.id} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm dark:bg-amber-950/25">
                              <p className="font-semibold text-on-surface">You asked: {d.chore_label}</p>
                              <p className="text-xs text-on-surface-variant">They still need to complete + proof</p>
                            </li>
                          ))}
                          {alerts!.pendingYourReview.map((r: ContributionRow) => (
                            <li key={r.id} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm dark:bg-amber-950/25">
                              <p className="font-semibold text-on-surface">{summarizeContribution(r)}</p>
                              <p className="text-xs text-on-surface-variant">Waiting on {partner} to approve</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="border-t border-outline-variant/15 px-3 py-3">
                      <Link
                        href="/#partner-asks"
                        onClick={() => setOpen(false)}
                        className="block rounded-xl bg-primary py-2.5 text-center text-sm font-bold text-on-primary"
                      >
                        Go to Home · open asks &amp; approvals
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
