"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CHORE_VP, effectiveChoreVp, type Effort } from "@/lib/vp";
import type { Household, Profile } from "@/types/db";

const ORDER: Effort[] = ["low", "medium", "high"];

type Props = {
  household: Household;
  profile: Profile;
  partner: Profile | null;
  onRefresh: () => Promise<void>;
};

function parseTier(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  if (Number.isNaN(n)) return null;
  return n;
}

export function ChoreVpSettings({ household, profile, partner, onRefresh }: Props) {
  const effective = effectiveChoreVp(household);
  const [low, setLow] = useState(String(effective.low));
  const [medium, setMedium] = useState(String(effective.medium));
  const [high, setHigh] = useState(String(effective.high));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const e = effectiveChoreVp(household);
    setLow(String(e.low));
    setMedium(String(e.medium));
    setHigh(String(e.high));
    setErr(null);
    setEditing(false);
  }, [
    household.chore_vp_low,
    household.chore_vp_medium,
    household.chore_vp_high,
    household.chore_vp_pending_low,
    household.chore_vp_pending_medium,
    household.chore_vp_pending_high,
  ]);

  function beginEdit() {
    const e = effectiveChoreVp(household);
    setLow(String(e.low));
    setMedium(String(e.medium));
    setHigh(String(e.high));
    setErr(null);
    setEditing(true);
  }

  function cancelEdit() {
    const e = effectiveChoreVp(household);
    setLow(String(e.low));
    setMedium(String(e.medium));
    setHigh(String(e.high));
    setErr(null);
    setEditing(false);
  }

  const pending =
    household.chore_vp_pending_low != null &&
    household.chore_vp_pending_medium != null &&
    household.chore_vp_pending_high != null;

  const requesterId = household.chore_vp_pending_requested_by;
  const imRequester = Boolean(requesterId && requesterId === profile.id);
  const partnerCanReview = Boolean(partner && pending && requesterId && requesterId !== profile.id);

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    const l = parseTier(low);
    const m = parseTier(medium);
    const h = parseTier(high);
    if (l == null || m == null || h == null || l < 1 || l > 999 || m < 1 || m > 999 || h < 1 || h > 999) {
      setErr("Enter a number from 1 to 999 for each tier.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("propose_household_chore_vp", {
      p_low: l,
      p_medium: m,
      p_high: h,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(false);
    await onRefresh();
  }

  async function cancelProposal() {
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("cancel_household_chore_vp_proposal");
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await onRefresh();
  }

  async function resolveProposal(approve: boolean) {
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("resolve_household_chore_vp", { p_approve: approve });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await onRefresh();
  }

  const partnerName = partner?.display_name ?? "your partner";

  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/60 p-5">
      <h2 className="font-headline text-base font-bold text-on-surface">Chore point values</h2>
      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
        Defaults for this app are low {CHORE_VP.low} / medium {CHORE_VP.medium} / high {CHORE_VP.high} VP. You can
        agree on different numbers for your home
        {partner ? ` — ${partnerName} must approve the change` : ""}.
      </p>

      {pending && household.chore_vp_pending_low != null ? (
        <div className="mt-4 space-y-3 rounded-xl border border-secondary/25 bg-secondary-fixed/5 p-4">
          <p className="text-sm font-semibold text-on-surface">Proposed VP</p>
          <p className="text-sm text-on-surface-variant">
            Low {Number(household.chore_vp_pending_low)} · Medium {Number(household.chore_vp_pending_medium)} · High{" "}
            {Number(household.chore_vp_pending_high)}
          </p>
          {imRequester ? (
            <p className="text-sm text-on-surface-variant">
              Waiting for {partnerName} to approve.
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancelProposal()}
                className="ml-2 font-semibold text-primary underline"
              >
                Cancel proposal
              </button>
            </p>
          ) : null}
          {partnerCanReview ? (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolveProposal(true)}
                className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-on-primary"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolveProposal(false)}
                className="flex-1 rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface"
              >
                Decline
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!pending && !editing ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            {ORDER.map((tier: Effort) => (
              <div key={tier}>
                <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{tier}</span>
                <p className="mt-1 text-lg font-bold tabular-nums text-on-surface">{effective[tier]} VP</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={beginEdit}
            className="shrink-0 rounded-full border border-outline-variant/30 bg-surface-container-high px-5 py-2.5 text-sm font-bold text-on-surface disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      ) : null}

      {!pending && editing ? (
        <form onSubmit={submitProposal} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {ORDER.map((tier: Effort) => (
              <label key={tier} className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{tier}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tier === "low" ? low : tier === "medium" ? medium : high}
                  onChange={(e) => {
                    if (tier === "low") setLow(e.target.value);
                    else if (tier === "medium") setMedium(e.target.value);
                    else setHigh(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2.5 text-on-surface"
                  disabled={busy}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface sm:min-w-[120px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-secondary py-3 text-sm font-bold text-on-secondary-container disabled:opacity-50 sm:min-w-[160px]"
            >
              {busy ? "Saving…" : partner ? "Propose new values" : "Save values"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
