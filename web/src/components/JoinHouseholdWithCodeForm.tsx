"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  onJoined: () => void;
};

/**
 * Link an auth user who has no `profiles` row yet to a household via invite code.
 * Same RPC flow as CompleteSetupForm “join with code”.
 */
export function JoinHouseholdWithCodeForm({ userId, onJoined }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr("Enter your display name.");
      return;
    }
    if (code.trim().length < 4) {
      setErr("Enter the household invite code.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    try {
      const { data: hid, error: fe } = await supabase.rpc("household_id_by_invite", {
        p_code: code.trim(),
      });
      if (fe) throw fe;
      if (!hid) throw new Error("No household matches that code.");
      const householdId = hid as string;
      const { data: slot, error: se } = await supabase.rpc("next_member_slot", {
        p_household: householdId,
      });
      if (se) throw se;
      if (!slot) throw new Error("That household already has two members.");
      const { error: pe } = await supabase.from("profiles").insert({
        id: userId,
        household_id: householdId,
        display_name: name.trim(),
        member_slot: slot as "a" | "b",
      });
      if (pe) throw pe;
      onJoined();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : e instanceof Error
            ? e.message
            : "Could not join.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-secondary/25 bg-secondary-fixed/5 p-5">
      <h2 className="font-headline text-lg font-bold text-on-surface">Join a household</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Have your partner&apos;s invite code? Enter it here to link this account — you must not already be in a
        household.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold text-on-surface">
          Your display name
          <input
            className="mt-1 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 text-on-surface"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Alex"
            required
          />
        </label>
        <label className="block text-sm font-semibold text-on-surface">
          Invite code
          <input
            className="mt-1 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 font-mono uppercase tracking-wider text-on-surface"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
            autoComplete="off"
            required
          />
        </label>
        {err ? <p className="text-sm text-red-700 dark:text-red-300">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-secondary py-3 text-sm font-bold text-on-secondary-container disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join household"}
        </button>
      </form>
    </section>
  );
}
