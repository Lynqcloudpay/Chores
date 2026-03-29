"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CompleteSetupForm } from "@/components/CompleteSetupForm";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";

/** Logged-in users finish household linking here — not on /register (that’s for new emails only). */
export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: prof } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle();
    if (prof) {
      router.replace("/");
      router.refresh();
      return;
    }
    setUserId(uid);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        router.replace("/login");
        return;
      }
      let effective = session;
      if (event === "INITIAL_SESSION") {
        effective = await sessionOrRecover(supabase, session);
      }
      if (event === "INITIAL_SESSION" && !effective?.user?.id) {
        router.replace("/login");
        return;
      }
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && effective?.user?.id) {
        await refresh(effective.user.id);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, refresh]);

  if (!ready || !userId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-slate-900">Finish household setup</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600">
        You’re signed in. Create a household or join with your partner’s code — this is{" "}
        <strong>not</strong> “create a new account” (your email is already registered).
      </p>
      <div className="mt-8">
        <CompleteSetupForm
          userId={userId}
          onComplete={() => {
            router.push("/setup/chores");
          }}
        />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          Back to home
        </Link>
        {" · "}
        <button
          type="button"
          className="font-semibold text-blue-600 underline"
          onClick={async () => {
            const supabase = getSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </p>
    </div>
  );
}
