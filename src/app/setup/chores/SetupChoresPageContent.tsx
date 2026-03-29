"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HouseholdChoreSetupForm } from "@/components/HouseholdChoreSetupForm";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";
import type { Effort } from "@/lib/vp";

export function SetupChoresPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceEdit = searchParams.get("edit") === "1";

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null);
  const [initialPresets, setInitialPresets] = useState<{ effort: Effort; label: string }[]>([]);

  const load = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: prof, error: pe } = await supabase.from("profiles").select("household_id").eq("id", uid).maybeSingle();
    if (pe || !prof) {
      router.replace("/setup");
      return;
    }
    const hid = prof.household_id as string;
    setHouseholdId(hid);
    const { data: hh } = await supabase.from("households").select("chore_presets_onboarded_at").eq("id", hid).single();
    setOnboardedAt((hh as { chore_presets_onboarded_at?: string | null } | null)?.chore_presets_onboarded_at ?? null);

    const { data: presets } = await supabase.from("household_chore_presets").select("effort,label").eq("household_id", hid);
    const rows =
      (presets ?? [])
        .map((r) => ({
          effort: r.effort as Effort,
          label: String(r.label),
        }))
        .filter((r) => r.effort === "low" || r.effort === "medium" || r.effort === "high") ?? [];
    setInitialPresets(rows);
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
      const uid = effective?.user?.id ?? null;
      setUserId(uid);
      if (uid) await load(uid);
      if (event === "INITIAL_SESSION") setReady(true);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, load]);

  if (!ready || !userId || !householdId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  const showDoneOnly = onboardedAt && !forceEdit;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-slate-900">Chore list</h1>

      {showDoneOnly ? (
        <div className="mt-8 space-y-4 text-center">
          <p className="text-sm text-slate-600">
            Your household already saved a chore list. You can update it anytime — effort levels are only for your own
            tracking and fairness.
          </p>
          <Link
            href="/"
            className="inline-flex w-full justify-center rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white"
          >
            Go to dashboard
          </Link>
          <Link href="/setup/chores?edit=1" className="block text-sm font-semibold text-blue-600 underline">
            Update chore list
          </Link>
        </div>
      ) : (
        <>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600">
            Build a short list you’ll use when logging chores. Suggestions help you not forget anything — tweak effort
            levels to match what feels fair for you.
          </p>
          <div className="mt-8">
            <HouseholdChoreSetupForm
              householdId={householdId}
              initialFromDb={initialPresets.length > 0 ? initialPresets : undefined}
              onDone={() => {
                router.replace("/");
                router.refresh();
              }}
            />
          </div>
          <p className="mt-6 text-center">
            <button
              type="button"
              className="text-sm font-semibold text-slate-500 underline"
              onClick={() => router.replace("/")}
            >
              Skip for now — use default suggestions in the app
            </button>
          </p>
        </>
      )}

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          Home
        </Link>
      </p>
    </div>
  );
}
