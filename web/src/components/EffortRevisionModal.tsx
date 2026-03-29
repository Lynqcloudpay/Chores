"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Effort } from "@/lib/vp";
import type { ContributionRow } from "@/types/db";

const ORDER: Effort[] = ["low", "medium", "high"];

type Props = {
  /** Effective VP per tier for this household (used for labels). */
  choreVp: Record<Effort, number>;
  open: boolean;
  row: ContributionRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function EffortRevisionModal({ choreVp, open, row, onClose, onSuccess }: Props) {
  const [choice, setChoice] = useState<Effort>("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row?.effort) return;
    const first = ORDER.find((e) => e !== row.effort) ?? "medium";
    setChoice(first);
    setErr(null);
  }, [open, row]);

  if (!open || !row || row.kind !== "chore" || !row.effort) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!row?.effort) return;
    if (choice === row.effort) {
      setErr("Pick a different effort level.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("request_effort_revision", {
      p_contribution: row.id,
      p_new_effort: choice,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={busy ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-t-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-2xl sm:rounded-3xl"
      >
        <h3 className="font-headline text-lg font-bold text-on-surface">Change effort level</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          Current: <strong className="text-on-surface capitalize">{row.effort}</strong> ({choreVp[row.effort]} VP).
          Your partner must approve the new level before VP updates.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-2">
            {ORDER.map((eff) => (
              <label key={eff} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="effort-revision"
                  className="peer sr-only"
                  checked={choice === eff}
                  onChange={() => setChoice(eff)}
                  disabled={eff === row.effort}
                />
                <div
                  className={`flex items-center justify-between rounded-xl border border-transparent bg-surface-container-low p-3 peer-checked:border-primary/40 peer-checked:bg-primary/5 ${
                    eff === row.effort ? "opacity-40" : ""
                  }`}
                >
                  <span className="font-semibold capitalize text-on-surface">{eff}</span>
                  <span className="text-sm font-bold text-primary">{choreVp[eff]} VP</span>
                </div>
              </label>
            ))}
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || choice === row.effort}
              className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-50"
            >
              {busy ? "Sending…" : "Request approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
