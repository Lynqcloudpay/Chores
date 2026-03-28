"use client";

import { useEffect, useMemo, useState } from "react";
import { ProofLinkButton } from "@/components/ProofLinkButton";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isApproved } from "@/lib/contribution-status";
import type { ContributionRow, Profile } from "@/types/db";

type Props = {
  rows: ContributionRow[];
  profile: Profile;
  partner: Profile | null;
  currentUserId: string;
  /** Open effort revision flow for an approved chore you logged. */
  onChangeEffort: (row: ContributionRow) => void;
  onRefresh: () => void;
};

function labelForRow(r: ContributionRow): string {
  if (r.kind === "provision" && r.amount_cents != null) {
    const dollars = r.amount_cents / 100;
    return `Provision $${dollars.toFixed(2)}`;
  }
  if (r.kind === "chore" && r.note?.trim()) {
    return r.note.trim();
  }
  if (r.kind === "chore" && r.effort) {
    return `${r.effort[0].toUpperCase()}${r.effort.slice(1)} effort`;
  }
  return "Contribution";
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.floor(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function RecentActivity({
  rows,
  profile,
  partner,
  currentUserId,
  onChangeEffort,
  onRefresh,
}: Props) {
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  /** Expanded by default; user can collapse the whole block. */
  const [logExpanded, setLogExpanded] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#activity-log") return;
    setLogExpanded(true);
  }, [rows.length]);

  const idToName = new Map<string, string>();
  idToName.set(profile.id, profile.display_name);
  if (partner) idToName.set(partner.id, partner.display_name);

  async function cancelRevision(id: string) {
    setCancelBusyId(id);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("cancel_effort_revision", { p_contribution: id });
    setCancelBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    onRefresh();
  }

  if (rows.length === 0) {
    return (
      <section id="activity-log" className="scroll-mt-24 space-y-4">
        <h2 className="font-headline text-2xl font-bold text-on-background">Recent activity</h2>
        <p className="text-sm text-on-surface-variant">No entries this week yet.</p>
      </section>
    );
  }

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rows],
  );
  const moreThanPreview = sortedRows.length > 5;

  return (
    <section id="activity-log" className="scroll-mt-24">
      <details
        open={logExpanded}
        onToggle={(e) => setLogExpanded(e.currentTarget.open)}
        className="group rounded-2xl border border-outline-variant/15 bg-surface-container-low/30 open:bg-surface-container-low/50"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 text-left">
            <h2 className="font-headline text-2xl font-bold text-on-background">Recent activity</h2>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {sortedRows.length} {sortedRows.length === 1 ? "entry" : "entries"} this week · newest first
              {moreThanPreview ? (
                <>
                  {" "}
                  · about five entries show at once — scroll the list below for older ones
                </>
              ) : null}
              <span className="sr-only"> Collapse or expand this section with the control on the right.</span>
            </p>
          </div>
          <span
            className="material-symbols-outlined shrink-0 text-on-surface-variant transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          >
            expand_more
          </span>
        </summary>
        <div
          className={`space-y-3 overscroll-contain border-t border-outline-variant/10 px-4 pb-4 pt-3 ${
            moreThanPreview ? "max-h-[min(26rem,55vh)] overflow-y-auto" : ""
          }`}
        >
          {sortedRows.map((r) => {
            const mine = r.profile_id === currentUserId;
            const canRequestEffort =
              partner &&
              r.kind === "chore" &&
              isApproved(r) &&
              !r.effort_revision_pending &&
              mine &&
              r.effort;
            const showCancel = mine && r.kind === "chore" && r.effort_revision_pending;

            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-2 rounded-2xl bg-surface-container-low p-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-highest">
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">
                      {r.kind === "provision" ? "payments" : "task_alt"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface">{labelForRow(r)}</p>
                    <p className="text-xs text-on-surface-variant">
                      {idToName.get(r.profile_id) ?? "Partner"} · {timeAgo(r.created_at)}
                    </p>
                    {r.kind === "chore" && r.effort && r.effort_revision_pending && r.pending_effort ? (
                      <p className="mt-1 text-xs font-medium text-secondary">
                        Effort change pending: {r.effort} ({Number(r.vp)} VP) → {r.pending_effort} (
                        {Number(r.pending_vp)} VP)
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <ProofLinkButton storagePath={r.proof_storage_path} />
                      {canRequestEffort ? (
                        <button
                          type="button"
                          onClick={() => onChangeEffort(r)}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-2.5 py-1 text-xs font-semibold text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Change effort
                        </button>
                      ) : null}
                      {showCancel ? (
                        <button
                          type="button"
                          disabled={cancelBusyId !== null}
                          onClick={() => void cancelRevision(r.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-2.5 py-1 text-xs font-semibold text-on-surface-variant"
                        >
                          {cancelBusyId === r.id ? "…" : "Cancel request"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {r.kind === "chore" && r.effort_revision_pending && r.pending_vp != null ? (
                    <>
                      <span className="text-sm font-extrabold text-on-surface">+{Number(r.vp)} VP</span>
                      <span className="block text-[11px] font-semibold text-secondary">
                        → {Number(r.pending_vp)} VP if approved
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-extrabold text-primary">+{Number(r.vp)} VP</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
