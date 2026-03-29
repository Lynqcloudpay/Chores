"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { removeAllHouseholdProofFiles } from "@/lib/upload-proof";

type Props = {
  householdId: string;
  onResetComplete: () => void | Promise<void>;
};

export function ResetHouseholdSection({ householdId, onResetComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = phrase.trim().toUpperCase() === "RESET" && !busy;

  async function submit() {
    if (!canSubmit) return;
    setErr(null);
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc("reset_household_equity_data", {
        p_confirm: phrase.trim(),
      });
      if (rpcErr) {
        setErr(rpcErr.message);
        return;
      }
      setPhrase("");
      try {
        await removeAllHouseholdProofFiles(supabase, householdId);
        setOpen(false);
        setErr(null);
      } catch (e) {
        console.warn("Proof cleanup:", e);
        setErr("History was cleared; some proof files could not be deleted from storage. Try again or clear the bucket in Supabase.");
      }
      await onResetComplete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-red-200/80 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setErr(null);
        }}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-bold text-red-900 dark:text-red-200">Start clean — reset household data</span>
        <span className="material-symbols-outlined text-red-800/80 dark:text-red-300">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      <p className="mt-1 text-xs leading-relaxed text-red-900/80 dark:text-red-200/80">
        Removes all logged contributions, partner asks, chore presets, and custom VP settings for this home. Your accounts
        and invite link stay the same. Use after a breakup or when you want a fresh counter.
      </p>
      {open ? (
        <div className="mt-4 space-y-3 border-t border-red-200/60 pt-4 dark:border-red-900/40">
          <label className="block text-xs font-semibold text-red-950 dark:text-red-100">
            Type <span className="font-mono">RESET</span> to confirm
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              placeholder="RESET"
              className="mt-1.5 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 dark:border-red-900/50 dark:bg-gray-950"
            />
          </label>
          {err ? <p className="text-xs font-medium text-red-700 dark:text-red-300">{err}</p> : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="w-full rounded-full bg-red-700 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-40 dark:bg-red-800"
          >
            {busy ? "…" : "Erase history and reset counters"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
