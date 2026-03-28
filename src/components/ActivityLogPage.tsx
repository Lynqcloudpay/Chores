"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MobileShell } from "@/components/MobileShell";
import { RecentActivity } from "@/components/RecentActivity";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";
import { getWeekStartSunday, toDateKey } from "@/lib/week";
import { effectiveChoreVp } from "@/lib/vp";
import type { ContributionRow, Household, Profile } from "@/types/db";
import { isApproved } from "@/lib/contribution-status";

const EffortRevisionModal = dynamic(
  () => import("@/components/EffortRevisionModal").then((m) => m.EffortRevisionModal),
  { ssr: false },
);

/**
 * Full-week activity log (same data as dashboard Recent activity) on /logs.
 */
export function ActivityLogPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [weekRows, setWeekRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [effortRevisionRow, setEffortRevisionRow] = useState<ContributionRow | null>(null);

  const weekKey = useMemo(() => toDateKey(getWeekStartSunday()), []);

  const refreshProfiles = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) {
      setProfile(null);
      setHousehold(null);
      setPartner(null);
      return;
    }
    const p = prof as Profile;
    setProfile(p);
    const hid = p.household_id;
    const [hhRes, othersRes] = await Promise.all([
      supabase.from("households").select("*").eq("id", hid).single(),
      supabase.from("profiles").select("*").eq("household_id", hid).neq("id", uid),
    ]);
    if (hhRes.error) setHousehold(null);
    else setHousehold(hhRes.data as Household);
    if (othersRes.error) setPartner(null);
    else setPartner((othersRes.data?.[0] as Profile | undefined) ?? null);
  }, []);

  const loadContributions = useCallback(
    async (hid: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error: penErr } = await supabase.rpc("apply_delegation_penalties", {
        p_current_week_start: weekKey,
      });
      if (penErr) console.warn(penErr.message);
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .eq("household_id", hid)
        .eq("week_start", weekKey)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn(error.message);
        return;
      }
      setWeekRows((data as ContributionRow[]) ?? []);
    },
    [weekKey],
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      let effective = session;
      if (event === "INITIAL_SESSION") {
        effective = await sessionOrRecover(supabase, session);
      }
      const uid = effective?.user?.id ?? null;
      setUserId(uid);
      if (uid) void refreshProfiles(uid);
      else {
        setProfile(null);
        setHousehold(null);
        setPartner(null);
        setWeekRows([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshProfiles]);

  useEffect(() => {
    if (!household?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadContributions(household.id).finally(() => setLoading(false));
  }, [household?.id, loadContributions]);

  const approvedRows = useMemo(() => weekRows.filter(isApproved), [weekRows]);
  const choreVpTiers = useMemo(() => (household ? effectiveChoreVp(household) : { low: 15, medium: 30, high: 50 }), [household]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-on-surface-variant">
        Configure Supabase env vars first.
      </div>
    );
  }

  if (!userId || !profile || !household) {
    return (
      <MobileShell active="logs">
        <AppHeader displayName={profile?.display_name} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-on-surface-variant">
            <Link href="/login" className="font-semibold text-primary underline">
              Sign in
            </Link>{" "}
            to see this week&apos;s log.
          </p>
        </main>
      </MobileShell>
    );
  }

  return (
    <MobileShell active="logs">
      <AppHeader displayName={profile.display_name} />
      <main className="mx-auto w-full max-w-2xl space-y-4 px-3 pb-32 pt-5 sm:px-4 sm:pb-40 sm:pt-6">
        <div>
          <Link href="/" className="text-sm font-semibold text-primary underline underline-offset-2">
            ← Home
          </Link>
          <h1 className="mt-2 font-headline text-xl font-bold text-on-surface">This week&apos;s log</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Entries for the current week · newest first</p>
        </div>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : (
          <RecentActivity
            rows={approvedRows}
            profile={profile}
            partner={partner}
            currentUserId={userId}
            onChangeEffort={(r) => setEffortRevisionRow(r)}
            onRefresh={() => void loadContributions(household.id)}
            variant="fullPage"
          />
        )}
      </main>

      <EffortRevisionModal
        choreVp={choreVpTiers}
        open={effortRevisionRow !== null}
        row={effortRevisionRow}
        onClose={() => setEffortRevisionRow(null)}
        onSuccess={() => void loadContributions(household.id)}
      />
    </MobileShell>
  );
}
