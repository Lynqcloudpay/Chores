"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";

function randomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function RegisterPage() {
  const router = useRouter();
  const [gateReady, setGateReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [join, setJoin] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Logged-in users must not use this page — they need /setup or home, not signUp again. */
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setGateReady(true);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "INITIAL_SESSION") return;
      if (cancelled) return;
      const recovered = await sessionOrRecover(supabase, session);
      if (!recovered?.user?.id) {
        setGateReady(true);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", recovered.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (prof) {
        router.replace("/");
        return;
      }
      router.replace("/setup");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!isSupabaseConfigured()) {
      setErr("Configure NEXT_PUBLIC_SUPABASE_* in .env.local");
      return;
    }
    // Supabase project may enforce stricter minimum (check Dashboard → Auth → Providers → Email).
    if (password.length < 6) {
      setErr("Password must be at least 6 characters (your project may require more).");
      return;
    }
    if (join && code.trim().length < 4) {
      setErr("Enter your partner’s invite code.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { data: authData, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setBusy(false);
      const msg = (error.message || "").toLowerCase();
      const already =
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists") ||
        error.code === "user_already_exists";
      setErr(
        already
          ? `${error.message} Use “Sign in” below with this email, or reset the password in Supabase Auth if you forgot it.`
          : `${error.message}${error.status === 422 ? " (422: validation — check password rules and email format in Supabase → Authentication.)" : ""}`,
      );
      return;
    }
    const user = authData.user;
    const session = authData.session;
    if (!user) {
      setBusy(false);
      setErr("Check your email to confirm, then sign in.");
      return;
    }
    if (!session) {
      setBusy(false);
      setErr(
        "No active session after sign-up (often because email confirmation is required). In Supabase → Authentication → Providers → Email, disable “Confirm email” for testing, or confirm your email and sign in first.",
      );
      return;
    }

    try {
      if (!join) {
        const invite = randomInviteCode();
        const { data: hh, error: he } = await supabase
          .from("households")
          .insert({
            name: "Home",
            invite_code: invite,
            created_by: user.id,
          })
          .select()
          .single();
        if (he) throw he;
        const { error: pe } = await supabase.from("profiles").insert({
          id: user.id,
          household_id: hh.id,
          display_name: name.trim(),
          member_slot: "a",
        });
        if (pe) throw pe;
        alert(`Share this code with your partner: ${invite}`);
        router.replace("/setup/chores");
        router.refresh();
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
          id: user.id,
          household_id: householdId,
          display_name: name.trim(),
          member_slot: slot as "a" | "b",
        });
        if (pe) throw pe;
        router.replace("/");
        router.refresh();
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

  if (!gateReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Checking your session…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
      <p className="mt-2 text-slate-600">Start a household or join with a code.</p>
      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-800">
        <strong className="text-slate-900">Already created an account?</strong> Don’t sign up again —{" "}
        <Link href="/login" className="font-semibold text-blue-700 underline">
          sign in
        </Link>
        , then go to{" "}
        <Link href="/setup" className="font-semibold text-blue-700 underline">
          Finish setup
        </Link>{" "}
        if you need to link a household (no duplicate email).
      </div>

      <div className="mt-6 flex gap-2">
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

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500">Display name</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
          {busy ? "Working…" : join ? "Join household" : "Create household"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Already have an account? Sign in
        </Link>
      </p>
    </div>
  );
}
