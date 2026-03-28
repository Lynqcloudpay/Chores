"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChoreLegend } from "@/components/ChoreLegend";
import { ContributionGapHero } from "@/components/ContributionGapHero";
import { DashboardHints } from "@/components/DashboardHints";
import { DashboardWeekSkeleton } from "@/components/DashboardWeekSkeleton";
import { DelegationAsks } from "@/components/DelegationAsks";
import { CompleteSetupForm } from "@/components/CompleteSetupForm";
import { EquityEngineRulesModal } from "@/components/EquityEngineRulesModal";
import { EquityEngineWelcome } from "@/components/EquityEngineWelcome";
import { MobileShell } from "@/components/MobileShell";
import { PathToParity } from "@/components/PathToParity";
import { PendingApprovals } from "@/components/PendingApprovals";
import { countsTowardVp, isPending } from "@/lib/contribution-status";
import type { ProofCaptureResult } from "@/components/ProofCaptureModal";

const ContributionModal = dynamic(
  () => import("@/components/ContributionModal").then((m) => m.ContributionModal),
  { ssr: false },
);
const EffortRevisionModal = dynamic(
  () => import("@/components/EffortRevisionModal").then((m) => m.EffortRevisionModal),
  { ssr: false },
);
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadContributionProof } from "@/lib/upload-proof";
import { sessionOrRecover } from "@/lib/supabase/session";
import { getWeekStartSunday, toDateKey } from "@/lib/week";
import { effectiveChoreVp, vpFromDollars, vpFromEffort, type Effort } from "@/lib/vp";
import type { ContributionRow, DelegationRequestRow, Household, Profile } from "@/types/db";

const EMPTY_EXTRA_PRESETS: Record<Effort, string[]> = {
  low: [],
  medium: [],
  high: [],
};

export function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [weekRows, setWeekRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [effortRevisionRow, setEffortRevisionRow] = useState<ContributionRow | null>(null);
  const [householdExtraPresets, setHouseholdExtraPresets] =
    useState<Record<Effort, string[]>>(EMPTY_EXTRA_PRESETS);
  const [delegations, setDelegations] = useState<DelegationRequestRow[]>([]);

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
    if (hhRes.error) {
      console.warn(hhRes.error.message);
      setHousehold(null);
    } else {
      setHousehold(hhRes.data as Household);
    }
    if (othersRes.error) {
      console.warn(othersRes.error.message);
      setPartner(null);
    } else {
      setPartner((othersRes.data?.[0] as Profile | undefined) ?? null);
    }
  }, []);

  const loadHouseholdRow = useCallback(async (hid: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("households").select("*").eq("id", hid).single();
    if (error) {
      console.warn(error.message);
      return;
    }
    if (data) setHousehold(data as Household);
  }, []);

  /** Setup presets + custom free-text chores (pending or approved) so the legend stays current. */
  const loadHouseholdPresets = useCallback(async (hid: string) => {
    const supabase = getSupabaseBrowserClient();
    const [presetRes, choreRes] = await Promise.all([
      supabase.from("household_chore_presets").select("effort,label").eq("household_id", hid),
      supabase
        .from("contributions")
        .select("effort,note,chore_source,status")
        .eq("household_id", hid)
        .eq("kind", "chore")
        .in("status", ["pending", "approved"])
        .not("note", "is", null),
    ]);
    if (presetRes.error) console.warn(presetRes.error.message);
    if (choreRes.error) console.warn(choreRes.error.message);

    const next: Record<Effort, string[]> = { low: [], medium: [], high: [] };
    const seen: Record<Effort, Set<string>> = {
      low: new Set(),
      medium: new Set(),
      high: new Set(),
    };

    function addLabel(effort: Effort, label: string) {
      const t = label.trim();
      if (!t) return;
      const k = t.toLowerCase();
      if (seen[effort].has(k)) return;
      seen[effort].add(k);
      next[effort].push(t);
    }

    for (const r of presetRes.data ?? []) {
      const e = r.effort as Effort;
      if (e === "low" || e === "medium" || e === "high") addLabel(e, String(r.label));
    }

    for (const r of choreRes.data ?? []) {
      if (r.chore_source === "preset") continue;
      const note = String(r.note ?? "").trim();
      if (!note) continue;
      const st = (r.status ?? "approved") as string;
      if (r.chore_source === "custom") {
        const e = r.effort as Effort;
        if (e === "low" || e === "medium" || e === "high") addLabel(e, note);
        continue;
      }
      if (r.chore_source == null && st === "pending") {
        const e = r.effort as Effort;
        if (e === "low" || e === "medium" || e === "high") addLabel(e, note);
      }
    }

    setHouseholdExtraPresets(next);
  }, []);

  const loadContributions = useCallback(
    async (hid: string) => {
      const supabase = getSupabaseBrowserClient();
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

  const loadDelegations = useCallback(
    async (hid: string) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("delegation_requests")
        .select("*")
        .eq("household_id", hid)
        .eq("week_start", weekKey)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn(error.message);
        return;
      }
      setDelegations((data as DelegationRequestRow[]) ?? []);
    },
    [weekKey],
  );

  const refreshWeekData = useCallback(
    async (hid: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error: penErr } = await supabase.rpc("apply_delegation_penalties", {
        p_current_week_start: weekKey,
      });
      if (penErr) console.warn(penErr.message);
      await Promise.all([loadContributions(hid), loadDelegations(hid), loadHouseholdPresets(hid)]);
    },
    [weekKey, loadContributions, loadDelegations, loadHouseholdPresets],
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      if (event === "INITIAL_SESSION") {
        setReady(true);
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
    refreshWeekData(household.id).finally(() => setLoading(false));
  }, [household?.id, refreshWeekData]);

  /** Open contribution modal from `/?open=contribution` (e.g. center + from History). */
  useEffect(() => {
    if (searchParams.get("open") !== "contribution") return;
    if (!profile || !household) return;
    setModalOpen(true);
    router.replace("/", { scroll: false });
  }, [searchParams, router, profile, household]);

  /** Old bookmarks /#/activity-log → dedicated Logs tab. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#activity-log") {
      router.replace("/logs");
    }
  }, [router]);

  const countingRows = useMemo(() => weekRows.filter(countsTowardVp), [weekRows]);
  const pendingIncoming = useMemo(
    () =>
      weekRows.filter((r) => {
        if (!userId) return false;
        if (r.profile_id === userId) return false;
        if (r.effort_revision_pending && r.kind === "chore") return true;
        return isPending(r);
      }),
    [weekRows, userId],
  );
  const pendingOutgoing = useMemo(
    () =>
      weekRows.filter((r) => {
        if (!userId) return false;
        if (r.profile_id !== userId) return false;
        if (r.effort_revision_pending && r.kind === "chore") return true;
        return isPending(r);
      }),
    [weekRows, userId],
  );

  const { nameA, nameB, vpA, vpB, behindName, deficit } = useMemo(() => {
    const bySlot = (s: "a" | "b") => {
      if (profile?.member_slot === s) return profile.display_name;
      if (partner?.member_slot === s) return partner.display_name;
      return s === "a" ? "Partner A" : "Partner B";
    };
    const labelA = bySlot("a");
    const labelB = bySlot("b");
    let a = 0;
    let b = 0;
    const idToSlot = new Map<string, "a" | "b">();
    if (profile) idToSlot.set(profile.id, profile.member_slot);
    if (partner) idToSlot.set(partner.id, partner.member_slot);
    for (const r of countingRows) {
      const slot = idToSlot.get(r.profile_id);
      if (!slot) continue;
      if (slot === "a") a += Number(r.vp);
      else b += Number(r.vp);
    }
    const gap = Math.abs(a - b);
    const behind = a < b ? labelA : b < a ? labelB : null;
    return { nameA: labelA, nameB: labelB, vpA: a, vpB: b, behindName: behind, deficit: gap };
  }, [countingRows, profile, partner]);

  const myVpThisWeek = useMemo(() => {
    if (!profile) return 0;
    return countingRows
      .filter((r) => r.profile_id === profile.id)
      .reduce((sum, r) => sum + Number(r.vp), 0);
  }, [countingRows, profile]);

  const partnerVpThisWeek = useMemo(() => {
    if (!partner) return 0;
    return countingRows
      .filter((r) => r.profile_id === partner.id)
      .reduce((sum, r) => sum + Number(r.vp), 0);
  }, [countingRows, partner]);

  const canSendDelegationAsk = Boolean(partner && myVpThisWeek > partnerVpThisWeek);

  const choreVpTiers = useMemo(() => effectiveChoreVp(household), [household]);

  async function handleSubmitRequest(payload: {
    kind: "provision" | "chore";
    dollars?: number;
    effort?: Effort;
    note?: string;
    choreEntryType?: "preset" | "custom";
    proof: ProofCaptureResult;
  }) {
    if (!profile || !household || !userId) return;
    const vp =
      payload.kind === "provision" && payload.dollars != null
        ? vpFromDollars(payload.dollars)
        : payload.kind === "chore" && payload.effort
          ? vpFromEffort(payload.effort, choreVpTiers)
          : 0;
    if (vp <= 0) return;
    const needsPartnerApproval =
      payload.kind === "chore" && payload.choreEntryType === "custom";
    const status = needsPartnerApproval ? "pending" : "approved";
    const contributionId = crypto.randomUUID();
    setSubmitting(true);
    const supabase = getSupabaseBrowserClient();
    try {
      const { path } = await uploadContributionProof(
        supabase,
        household.id,
        contributionId,
        payload.proof.blob,
        payload.proof.contentType,
      );
      const { error } = await supabase.from("contributions").insert({
        id: contributionId,
        household_id: household.id,
        profile_id: userId,
        kind: payload.kind,
        amount_cents:
          payload.kind === "provision" && payload.dollars != null
            ? Math.round(payload.dollars * 100)
            : null,
        effort: payload.kind === "chore" ? payload.effort ?? null : null,
        vp,
        note: payload.note ?? null,
        week_start: weekKey,
        status,
        chore_source:
          payload.kind === "chore"
            ? payload.choreEntryType === "custom"
              ? "custom"
              : "preset"
            : null,
        proof_storage_path: path,
        proof_captured_at: payload.proof.capturedAtIso,
      });
      if (error) {
        alert(error.message);
        throw new Error(error.message);
      }
      await refreshWeekData(household.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      alert(msg);
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(id: string) {
    if (!userId || !household) return;
    const row = weekRows.find((r) => r.id === id);
    setReviewBusyId(id);
    const supabase = getSupabaseBrowserClient();

    if (row?.effort_revision_pending) {
      const { error } = await supabase.rpc("resolve_effort_revision", {
        p_contribution: id,
        p_approve: true,
      });
      setReviewBusyId(null);
      if (error) {
        alert(error.message);
        return;
      }
      await refreshWeekData(household.id);
      return;
    }

    const { error } = await supabase
      .from("contributions")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    setReviewBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    const note = row?.note?.trim();
    const shouldAddPreset =
      row &&
      isPending(row) &&
      row.kind === "chore" &&
      row.effort &&
      note &&
      (row.chore_source === "custom" || row.chore_source == null);
    if (shouldAddPreset) {
      const { error: presetErr } = await supabase.from("household_chore_presets").insert({
        household_id: household.id,
        effort: row.effort,
        label: note,
      });
      if (presetErr && presetErr.code !== "23505") {
        console.warn(presetErr.message);
      }
    }
    await refreshWeekData(household.id);
  }

  async function handleReject(id: string) {
    if (!userId || !household) return;
    const row = weekRows.find((r) => r.id === id);
    setReviewBusyId(id);
    const supabase = getSupabaseBrowserClient();

    if (row?.effort_revision_pending) {
      const { error } = await supabase.rpc("resolve_effort_revision", {
        p_contribution: id,
        p_approve: false,
      });
      setReviewBusyId(null);
      if (error) {
        alert(error.message);
        return;
      }
      await refreshWeekData(household.id);
      return;
    }

    const { error } = await supabase
      .from("contributions")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    setReviewBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    await refreshWeekData(household.id);
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Equity Engine</h1>
        <p className="mt-4 text-slate-600">
          Add Supabase keys to{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-sm">web/.env.local</code>:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-emerald-100">
          {`NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…`}
        </pre>
        <p className="mt-4 text-sm text-slate-500">Restart the dev server after saving.</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-slate-500">Loading…</div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Equity Engine</h1>
        <p className="text-slate-600">Balance household contributions with Value Points — in your browser.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
          >
            New email — create account
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          Returning user? Use <strong>Sign in</strong> only. “Create account” is for a brand-new email.
        </p>
      </div>
    );
  }

  if (!profile || !household) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-center text-2xl font-bold text-slate-900">Equity Engine</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-600">
          Signed in, but no household is linked yet. Use the form below — or{" "}
          <Link href="/setup" className="font-semibold text-blue-600 underline">
            open the setup page
          </Link>
          . Do <strong>not</strong> use &quot;Create account&quot; (that email is already registered).
        </p>
        <div className="mt-8">
          <CompleteSetupForm
            userId={userId}
            onComplete={() => {
              void refreshProfiles(userId).then(() => router.push("/setup/chores"));
            }}
          />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Wrong account?{" "}
          <button
            type="button"
            onClick={() => void signOut()}
            className="font-semibold text-blue-600 underline"
          >
            Sign out
          </button>
        </p>
      </div>
    );
  }

  return (
    <MobileShell active="dashboard" onAddContribution={() => setModalOpen(true)}>
      <AppHeader displayName={profile.display_name} onHelp={() => setRulesModalOpen(true)} />
      <main className="mx-auto w-full max-w-2xl space-y-5 px-3 pb-28 pt-5 sm:space-y-6 sm:px-4 sm:pb-32 sm:pt-6">
        <EquityEngineWelcome profile={profile} partner={partner} household={household} />

        <DashboardHints hasPartner={Boolean(partner)} chorePresetsOnboarded={Boolean(household.chore_presets_onboarded_at)} />

        {loading ? (
          <DashboardWeekSkeleton />
        ) : (
          <>
            <ContributionGapHero nameA={nameA} nameB={nameB} vpA={vpA} vpB={vpB} />
            <ChoreLegend
              choreVp={choreVpTiers}
              householdExtraPresets={householdExtraPresets}
              includeGlobalPresets={!household.chore_presets_onboarded_at}
            />
            {partner && profile && userId ? (
              <DelegationAsks
                choreVp={choreVpTiers}
                householdId={household.id}
                weekKey={weekKey}
                userId={userId}
                partner={partner}
                delegations={delegations}
                canSendAsk={canSendDelegationAsk}
                myVpThisWeek={myVpThisWeek}
                partnerVpThisWeek={partnerVpThisWeek}
                onRefresh={() => refreshWeekData(household.id)}
              />
            ) : null}
            <PathToParity behindName={behindName} deficitVp={deficit} choreVp={choreVpTiers} />
            <PendingApprovals
              incoming={pendingIncoming}
              outgoing={pendingOutgoing}
              profile={profile}
              partner={partner}
              onApprove={(id) => void handleApprove(id)}
              onReject={(id) => void handleReject(id)}
              busyId={reviewBusyId}
            />
            <p className="border-t border-outline-variant/10 pt-4 text-center text-[11px] leading-relaxed text-on-surface-variant">
              Use the center <span className="font-semibold text-on-surface">+</span> to log ·{" "}
              <Link href="/logs" className="font-medium text-primary underline underline-offset-2">
                Logs
              </Link>{" "}
              for this week&apos;s activity ·{" "}
              <Link href="/history" className="font-medium text-primary underline underline-offset-2">
                History
              </Link>{" "}
              for past weeks. Weeks reset Sunday midnight.
            </p>
          </>
        )}
      </main>

      <EquityEngineRulesModal
        open={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        nameA={nameA}
        nameB={nameB}
      />
      <ContributionModal
        choreVp={choreVpTiers}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitRequest}
        busy={submitting}
        partnerName={partner?.display_name ?? "your partner"}
        householdExtraPresets={householdExtraPresets}
        includeGlobalPresets={!household.chore_presets_onboarded_at}
      />
      <EffortRevisionModal
        choreVp={choreVpTiers}
        open={effortRevisionRow !== null}
        row={effortRevisionRow}
        onClose={() => setEffortRevisionRow(null)}
        onSuccess={() => void refreshWeekData(household.id)}
      />
    </MobileShell>
  );
}
