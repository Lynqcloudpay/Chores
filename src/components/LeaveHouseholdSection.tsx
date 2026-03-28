"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  onLeft: () => void | Promise<void>;
};

export function LeaveHouseholdSection({ onLeft }: Props) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = phrase.trim().toUpperCase() === "LEAVE" && !busy;

  async function submit() {
    if (!canSubmit) return;
    setErr(null);
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("leave_household", { p_confirm: phrase.trim() });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setPhrase("");
    setOpen(false);
    await onLeft();
  }

  return (
    <section className="rounded-2xl border border-amber-800/30 bg-amber-50/40 p-5 dark:border-amber-700/40 dark:bg-amber-950/25">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setErr(null);
        }}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-bold text-amber-950 dark:text-amber-100">Leave household &amp; join another</span>
        <span className="material-symbols-outlined text-amber-900 dark:text-amber-200">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      <p className="mt-1 text-xs leading-relaxed text-amber-950/85 dark:text-amber-100/85">
        Removes you from this home so you can enter a different invite code. Your VP history in this home is deleted for
        your account. Your partner stays in the household.
      </p>
      {open ? (
        <div className="mt-4 space-y-3 border-t border-amber-800/25 pt-4 dark:border-amber-700/30">
          <label className="block text-xs font-semibold text-amber-950 dark:text-amber-50">
            Type <span className="font-mono">LEAVE</span> to confirm
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              placeholder="LEAVE"
              className="mt-1.5 w-full rounded-xl border border-amber-800/30 bg-white px-3 py-2.5 text-sm text-on-surface dark:border-amber-700/40 dark:bg-gray-950"
            />
          </label>
          {err ? <p className="text-xs font-medium text-red-700 dark:text-red-300">{err}</p> : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="w-full rounded-full bg-amber-900 py-3 text-sm font-bold text-white disabled:opacity-40 dark:bg-amber-800"
          >
            {busy ? "…" : "Leave this household"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
