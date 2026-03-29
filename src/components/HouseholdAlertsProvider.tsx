"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sessionOrRecover } from "@/lib/supabase/session";
import { getWeekStartSunday, toDateKey } from "@/lib/week";
import { isPending } from "@/lib/contribution-status";
import type { ContributionRow, DelegationRequestRow } from "@/types/db";

export type HouseholdAlertsValue = {
  loading: boolean;
  partnerName: string | null;
  /** Partner asked you to do something — photo proof needed. */
  incomingDelegations: DelegationRequestRow[];
  /** You asked your partner — waiting on them. */
  outgoingDelegations: DelegationRequestRow[];
  /** Contributions where your partner must approve / resolve effort. */
  pendingTheirReview: ContributionRow[];
  /** Your submissions waiting on partner approval. */
  pendingYourReview: ContributionRow[];
  refresh: () => Promise<void>;
};

const Ctx = createContext<HouseholdAlertsValue | null>(null);

function filterPendingForPartner(rows: ContributionRow[], userId: string): ContributionRow[] {
  return rows.filter((r) => {
    if (r.profile_id === userId) return false;
    if (r.effort_revision_pending && r.kind === "chore") return true;
    return isPending(r);
  });
}

function filterPendingFromPartner(rows: ContributionRow[], userId: string): ContributionRow[] {
  return rows.filter((r) => {
    if (r.profile_id !== userId) return false;
    if (r.effort_revision_pending && r.kind === "chore") return true;
    return isPending(r);
  });
}

export function HouseholdAlertsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [incomingDelegations, setIncomingDelegations] = useState<DelegationRequestRow[]>([]);
  const [outgoingDelegations, setOutgoingDelegations] = useState<DelegationRequestRow[]>([]);
  const [pendingTheirReview, setPendingTheirReview] = useState<ContributionRow[]>([]);
  const [pendingYourReview, setPendingYourReview] = useState<ContributionRow[]>([]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setPartnerName(null);
      setIncomingDelegations([]);
      setOutgoingDelegations([]);
      setPendingTheirReview([]);
      setPendingYourReview([]);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setLoading(false);
      setPartnerName(null);
      setIncomingDelegations([]);
      setOutgoingDelegations([]);
      setPendingTheirReview([]);
      setPendingYourReview([]);
      return;
    }
    const uid = user.id;
    const { data: prof, error: pe } = await supabase.from("profiles").select("id, household_id").eq("id", uid).maybeSingle();
    if (pe || !prof?.household_id) {
      setLoading(false);
      setPartnerName(null);
      setIncomingDelegations([]);
      setOutgoingDelegations([]);
      setPendingTheirReview([]);
      setPendingYourReview([]);
      return;
    }
    const hid = prof.household_id as string;
    const weekKey = toDateKey(getWeekStartSunday());

    const [partnerRes, delRes, contRes] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("household_id", hid).neq("id", uid).maybeSingle(),
      supabase
        .from("delegation_requests")
        .select("*")
        .eq("household_id", hid)
        .eq("week_start", weekKey)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("contributions")
        .select("*")
        .eq("household_id", hid)
        .or("status.eq.pending,effort_revision_pending.eq.true")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const pn = partnerRes.data?.display_name?.trim() ?? null;
    setPartnerName(pn);

    const dels = (delRes.data ?? []) as DelegationRequestRow[];
    const incoming = dels.filter((d) => d.assigned_to === uid);
    const outgoing = dels.filter((d) => d.requested_by === uid);

    const rows = (contRes.data ?? []) as ContributionRow[];
    const forPartner = filterPendingForPartner(rows, uid);
    const fromPartner = filterPendingFromPartner(rows, uid);

    setIncomingDelegations(incoming);
    setOutgoingDelegations(outgoing);
    setPendingTheirReview(forPartner);
    setPendingYourReview(fromPartner);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") {
        await sessionOrRecover(supabase, session);
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setLoading(true);
        await load();
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(), 45000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const value = useMemo<HouseholdAlertsValue>(
    () => ({
      loading,
      partnerName,
      incomingDelegations,
      outgoingDelegations,
      pendingTheirReview,
      pendingYourReview,
      refresh: load,
    }),
    [
      loading,
      partnerName,
      incomingDelegations,
      outgoingDelegations,
      pendingTheirReview,
      pendingYourReview,
      load,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHouseholdAlerts(): HouseholdAlertsValue | null {
  return useContext(Ctx);
}
