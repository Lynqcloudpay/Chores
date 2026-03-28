"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CHORE_VP, VP_PER_DOLLAR } from "@/lib/vp";

type Props = {
  open: boolean;
  onClose: () => void;
  nameA: string;
  nameB: string;
};

/**
 * Full rules & instructions — canonical copy for how the product works (keep in sync with behavior).
 */
export function EquityEngineRulesModal({ open, onClose, nameA, nameB }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />

      <div className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl bg-surface-container-lowest shadow-2xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/15 px-4 py-3 sm:px-5">
          <h2 id="rules-modal-title" className="font-headline text-lg font-bold text-on-surface">
            How Equity Engine works
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-[13px] leading-relaxed text-on-surface-variant sm:px-5 sm:py-5">
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-on-surface">This week &amp; Value Points</h3>
            <p>
              <strong className="text-on-surface">VP</strong> is for <strong className="text-on-surface">this calendar week only</strong> (week starts{" "}
              <strong className="text-on-surface">Sunday at midnight</strong> local). Each week resets — nothing rolls over automatically.
            </p>
            <p>
              The <strong className="text-on-surface">balance card</strong> on the home screen shows how approved VP is split between {nameA} and {nameB}. Use the{" "}
              <strong className="text-on-surface">center +</strong> in the bottom bar to log contributions.
            </p>
            <p>
              <Link href="/history" className="font-semibold text-primary underline underline-offset-2" onClick={onClose}>
                History
              </Link>{" "}
              is for <strong className="text-on-surface">past completed weeks</strong>, not the live current week.
            </p>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-bold text-on-surface">Logging money &amp; chores</h3>
            <p>
              <strong className="text-on-surface">Money:</strong> {VP_PER_DOLLAR} VP per $1. Choose <strong className="text-on-surface">Financial</strong>, enter the amount, attach a receipt photo.
            </p>
            <p>
              <strong className="text-on-surface">Chores:</strong> pick a <strong className="text-on-surface">preset</strong> or a <strong className="text-on-surface">custom</strong> chore. Custom chores need your partner to confirm the <strong className="text-on-surface">effort tier</strong> (low / medium / high). Chores need a photo.
            </p>
            <p>
              Default chore VP: <strong className="text-on-surface">{CHORE_VP.low}</strong> / <strong className="text-on-surface">{CHORE_VP.medium}</strong> /{" "}
              <strong className="text-on-surface">{CHORE_VP.high}</strong>. Change tiers under <strong className="text-on-surface">Chore point values</strong> (your partner may need to approve).
            </p>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-bold text-on-surface">Approvals, edits &amp; chore list</h3>
            <p>
              <strong className="text-on-surface">Pending approvals</strong> cover custom chores, effort revisions, and tier changes. Approve or reject from the dashboard.
            </p>
            <p>
              Set up presets in{" "}
              <Link href="/setup/chores" className="font-semibold text-primary underline underline-offset-2" onClick={onClose}>
                chore setup
              </Link>
              . The <strong className="text-on-surface">legend</strong> reflects presets and recent custom chores.
            </p>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-bold text-on-surface">Partner asks &amp; penalties</h3>
            <p>
              The partner with <strong className="text-on-surface">more VP this week</strong> (not tied) can{" "}
              <strong className="text-on-surface">request a task</strong> from the partner who owes (less VP). The assignee must upload{" "}
              <strong className="text-on-surface">photo proof</strong> within <strong className="text-on-surface">24 hours</strong> or receive a{" "}
              <strong className="text-on-surface">2× VP penalty</strong>. Use the Partner asks block on the home screen.
            </p>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-bold text-on-surface">Disputes &amp; fair play</h3>
            <p>
              In <strong className="text-on-surface">Recent activity</strong>, your partner can <strong className="text-on-surface">Dispute proof</strong> on a logged entry (financial or chore) if they believe the proof is fraudulent. VP for that line is{" "}
              <strong className="text-on-surface">frozen</strong> until the partner who opened the dispute resolves it: either proof is valid (VP counts) or it was fraudulent — the entry is rejected and a{" "}
              <strong className="text-on-surface">2× VP penalty</strong> applies against the person who logged it.
            </p>
          </section>

          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-bold text-on-surface">Logs, History &amp; Account</h3>
            <p>
              <strong className="text-on-surface">Logs</strong> jumps to this week&apos;s activity. <strong className="text-on-surface">History</strong> is the long-term ledger.{" "}
              <strong className="text-on-surface">Account</strong> (bottom bar) is for password, invite code, starting clean, and sign out.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
