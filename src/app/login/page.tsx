"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";

export default function LoginPage() {
  const router = useRouter();
  const [gateReady, setGateReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      } else {
        router.replace("/setup");
      }
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
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const { data: ures } = await supabase.auth.getUser();
    const uid = ures.user?.id;
    if (!uid) {
      router.replace("/setup");
      router.refresh();
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle();
    if (prof) {
      router.replace("/");
    } else {
      router.replace("/setup");
    }
    router.refresh();
  }

  if (!gateReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Checking your session…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-2 text-slate-600">Welcome back.</p>
      <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Expected flow:</span> sign in →{" "}
        <strong>dashboard</strong> if you already finished setup. If you never linked a household for this
        account, you’ll go to <strong>Finish setup</strong> (not registration — your email is already
        yours).
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500">Email</label>
          <input
            type="email"
            autoComplete="email"
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
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        First time with a <strong>new email</strong>?{" "}
        <Link href="/register" className="font-semibold text-blue-600 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-slate-500">
        Already logged in but need a household?{" "}
        <Link href="/setup" className="font-semibold text-blue-600 hover:underline">
          Finish setup
        </Link>
      </p>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← Home
        </Link>
      </p>
    </div>
  );
}
