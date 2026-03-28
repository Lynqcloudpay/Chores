"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MobileShell } from "@/components/MobileShell";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";
import { isApproved } from "@/lib/contribution-status";
import { formatWeekLabel, getWeekStartSunday, toDateKey } from "@/lib/week";
import type { ContributionRow, Household, Profile } from "@/types/db";

type WeekAgg = { week_start: string; vpA: number; vpB: number };

function weekHarmony(w: WeekAgg): number {
  const s = w.vpA + w.vpB;
  if (s <= 0) return 0;
  return Math.round(100 * (1 - Math.abs(w.vpA - w.vpB) / s));
}

export default function HistoryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const currentKey = useMemo(() => toDateKey(getWeekStartSunday()), []);

  const load = useCallback(async (uid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) return;
    const p = prof as Profile;
    setProfile(p);
    const hid = p.household_id;
    const { error: penErr } = await supabase.rpc("apply_delegation_penalties", {
      p_current_week_start: currentKey,
    });
    if (penErr) console.warn(penErr.message);

    const [hhRes, othersRes, contribsRes] = await Promise.all([
      supabase.from("households").select("*").eq("id", hid).single(),
      supabase.from("profiles").select("*").eq("household_id", hid).neq("id", uid),
      supabase
        .from("contributions")
        .select("*")
        .eq("household_id", hid)
        .order("week_start", { ascending: false }),
    ]);
    if (hhRes.error) console.warn(hhRes.error.message);
    else setHousehold(hhRes.data as Household);
    if (othersRes.error) setPartner(null);
    else setPartner((othersRes.data?.[0] as Profile | undefined) ?? null);
    if (!contribsRes.error && contribsRes.data) setRows(contribsRes.data as ContributionRow[]);
  }, [currentKey]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT") {
        return;
      }
      let effective = session;
      if (event === "INITIAL_SESSION") {
        effective = await sessionOrRecover(supabase, session);
      }
      const uid = effective?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        setLoading(true);
        void load(uid).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setPartner(null);
        setHousehold(null);
        setRows([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const weeks = useMemo(() => {
    const idToSlot = new Map<string, "a" | "b">();
    if (profile) idToSlot.set(profile.id, profile.member_slot);
    if (partner) idToSlot.set(partner.id, partner.member_slot);
    const map = new Map<string, WeekAgg>();
    for (const r of rows) {
      if (!isApproved(r)) continue;
      if (r.week_start === currentKey) continue;
      const slot = idToSlot.get(r.profile_id);
      if (!slot) continue;
      const cur = map.get(r.week_start) ?? { week_start: r.week_start, vpA: 0, vpB: 0 };
      if (slot === "a") cur.vpA += Number(r.vp);
      else cur.vpB += Number(r.vp);
      map.set(r.week_start, cur);
    }
    return [...map.values()].sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
  }, [rows, profile, partner, currentKey]);

  const chartWeeks = useMemo(() => {
    const slice = weeks.slice(0, 4);
    return [...slice].reverse();
  }, [weeks]);

  const avgHarmony = useMemo(() => {
    if (weeks.length === 0) return 0;
    const sum = weeks.reduce((s, w) => s + weekHarmony(w), 0);
    return Math.round(sum / weeks.length);
  }, [weeks]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-on-surface-variant">
        Configure <code className="font-mono">.env.local</code> first.
      </div>
    );
  }

  if (!userId || !profile || !household) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <p className="text-on-surface-variant">
          <Link href="/login" className="font-semibold text-secondary underline">
            Sign in
          </Link>{" "}
          to see history.
        </p>
      </div>
    );
  }

  return (
    <MobileShell active="history">
      <AppHeader displayName={profile.display_name} />
      <main className="mx-auto w-full max-w-2xl px-3 pb-40 pt-10 sm:px-4 sm:pb-44">
        <section className="mb-14">
          <p className="font-label mb-3 text-xs uppercase tracking-widest text-on-surface-variant">
            Historical Performance
          </p>
          <h1 className="font-headline mb-6 text-4xl font-bold tracking-tight text-on-surface md:text-5xl">
            The Living Ledger
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Review your household&apos;s journey toward total parity. Every recorded cycle is a step toward
            sustainable balance.
          </p>
        </section>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : weeks.length === 0 ? (
          <p className="text-on-surface-variant">No prior weeks yet. Check back after this week closes.</p>
        ) : (
          <>
            <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex h-[400px] flex-col justify-between rounded-xl bg-surface-container-lowest p-8 bento-shadow md:col-span-2">
                <div>
                  <h2 className="font-headline text-xl font-bold">Harmony Score</h2>
                  <p className="mb-8 text-sm text-on-surface-variant">Recent parity trend (by week)</p>
                </div>
                <div className="mb-4 flex flex-1 items-end justify-between gap-4">
                  {chartWeeks.map((w, i) => {
                    const h = weekHarmony(w);
                    const barH = Math.max(12, Math.min(100, h));
                    const isLast = i === chartWeeks.length - 1;
                    return (
                      <div key={w.week_start} className="flex flex-1 flex-col items-center group">
                        <div
                          className="relative w-full overflow-hidden rounded-t-lg bg-surface-container-high"
                          style={{ height: "180px" }}
                        >
                          <div
                            className={`absolute bottom-0 w-full transition-all duration-500 ${
                              isLast
                                ? "bg-gradient-to-t from-primary to-primary-container"
                                : "bg-primary-container/70"
                            }`}
                            style={{ height: `${barH}%` }}
                          />
                        </div>
                        <span
                          className={`mt-4 text-xs font-medium ${isLast ? "text-on-surface" : "text-on-surface-variant"}`}
                        >
                          {isLast ? "Latest" : `W${i + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="relative flex flex-col justify-center overflow-hidden rounded-xl bg-primary p-8 bento-shadow text-on-primary">
                <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary-container/20" />
                <span className="material-symbols-outlined mb-4 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_graph
                </span>
                <h3 className="font-headline text-3xl font-bold">{avgHarmony}%</h3>
                <p className="mb-6 text-sm leading-relaxed text-primary-fixed-dim">
                  Average parity score across completed weeks.
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-on-primary/10">
                  <div className="h-full bg-on-primary" style={{ width: `${avgHarmony}%` }} />
                </div>
              </div>
            </div>

            <section className="mb-20">
              <div className="mb-10 flex items-end justify-between">
                <h2 className="font-headline text-2xl font-bold text-on-surface">Past Cycles</h2>
              </div>
              <div className="space-y-6">
                {weeks.map((w) => {
                  const h = weekHarmony(w);
                  const balanced = h >= 98;
                  return (
                    <div
                      key={w.week_start}
                      className="group flex flex-col justify-between gap-6 rounded-xl bg-surface-container-lowest p-6 transition-all duration-300 hover:bg-surface-container-low md:flex-row md:items-center"
                    >
                      <div className="flex items-center gap-5">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full ${
                            balanced ? "bg-primary-container/10 text-primary" : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          <span className="material-symbols-outlined">
                            {balanced ? "event_available" : "history"}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-on-surface">{formatWeekLabel(w.week_start)}</h4>
                          <p className="text-sm text-on-surface-variant">Household totals</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="flex -space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-surface-container-high text-[10px] font-bold text-on-surface">
                            {w.vpA.toFixed(0)} VP
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary-container text-[10px] font-bold text-white">
                            {w.vpB.toFixed(0)} VP
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`flex items-center justify-end gap-2 font-bold ${
                              balanced ? "text-primary" : "text-on-surface"
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {balanced ? "check_circle" : "warning"}
                            </span>
                            {balanced ? "100% Balanced" : `${h}% Parity`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <footer className="border-t border-outline-variant/10 py-12 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-container-low px-6 py-2">
                <span className="material-symbols-outlined text-sm text-primary">verified</span>
                <span className="text-sm font-medium italic text-on-surface-variant">
                  Consistency builds trust
                </span>
              </div>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant/60">Equity Engine</p>
            </footer>
          </>
        )}
      </main>
    </MobileShell>
  );
}
