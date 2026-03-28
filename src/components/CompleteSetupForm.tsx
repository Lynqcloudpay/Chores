"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function randomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

type Props = {
  userId: string;
  onComplete: () => void;
};

/** For users who already have an Auth account but no `profiles` row (signup didn’t finish). */
export function CompleteSetupForm({ userId, onComplete }: Props) {
  const [name, setName] = useState("");
  const [join, setJoin] = useState(false);
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
    if (join && code.trim().length < 4) {
      setErr("Enter your partner’s invite code.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();

    try {
      if (!join) {
        const invite = randomInviteCode();
        const { data: hh, error: he } = await supabase
          .from("households")
          .insert({
            name: "Home",
            invite_code: invite,
            created_by: userId,
          })
          .select()
          .single();
        if (he) throw he;
        const { error: pe } = await supabase.from("profiles").insert({
          id: userId,
          household_id: hh.id,
          display_name: name.trim(),
          member_slot: "a",
        });
        if (pe) throw pe;
        alert(`Your household invite code: ${invite}\n\nShare it with your partner so they can join.`);
        onComplete();
      } else {
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
        onComplete();
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : e instanceof Error
            ? e.message
            : "Setup failed.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Finish household setup</h2>
      <p className="mt-2 text-sm text-slate-600">
        You’re signed in, but your account isn’t linked to a household yet (for example if sign-up was
        interrupted). Create one or join with your partner’s code — you don’t need to register again.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setJoin(false)}
          className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold ${
            !join ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white"
          }`}
        >
          Start household
        </button>
        <button
          type="button"
          onClick={() => setJoin(true)}
          className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold ${
            join ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white"
          }`}
        >
          Join with code
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-500">Display name</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
          />
        </div>
        {join ? (
          <div>
            <label className="text-xs font-semibold text-slate-500">Invite code</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono uppercase text-slate-900"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
            />
          </div>
        ) : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : join ? "Join household" : "Create household"}
        </button>
      </form>
    </div>
  );
}
