"use client";

import { ProofLinkButton } from "@/components/ProofLinkButton";
import type { ContributionRow, Profile } from "@/types/db";
type Props = {
  incoming: ContributionRow[];
  outgoing: ContributionRow[];
  profile: Profile;
  partner: Profile | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busyId: string | null;
};

function summarize(r: ContributionRow): string {
  if (r.effort_revision_pending && r.kind === "chore" && r.effort && r.pending_effort) {
    const note = r.note?.trim();
    const base = note ? note : "Chore";
    return `${base} · effort change: ${r.effort} (${Number(r.vp)} VP) → ${r.pending_effort} (${Number(r.pending_vp)} VP)`;
  }
  if (r.kind === "provision" && r.amount_cents != null) {
    return `Financial · $${(r.amount_cents / 100).toFixed(2)}`;
  }
  const note = r.note?.trim();
  if (r.kind === "chore" && r.effort) {
    return note
      ? `${note} · ${r.effort} (${Number(r.vp)} VP)`
      : `${r.effort} effort · ${Number(r.vp)} VP`;
  }
  return "Chore";
}

function sublineOutgoing(r: ContributionRow, partnerName: string): string {
  if (r.effort_revision_pending) {
    return `Waiting for ${partnerName} to confirm the new effort level`;
  }
  return `Pending ${partnerName}'s approval · +${Number(r.vp)} VP`;
}

export function PendingApprovals({
  incoming,
  outgoing,
  partner,
  onApprove,
  onReject,
  busyId,
}: Props) {
  const partnerName = partner?.display_name ?? "your partner";

  if (incoming.length === 0 && outgoing.length === 0) {
    return null;
  }

  return (
    <section id="pending-approvals" className="scroll-mt-24 space-y-4">
      <h2 className="font-headline text-2xl font-bold text-on-background">Approvals</h2>
      <p className="text-sm text-on-surface-variant">
        <strong className="text-on-surface">Custom chores</strong> and{" "}
        <strong className="text-on-surface">effort changes</strong> on logged chores need your partner&apos;s OK.
        Financial entries and preset chores without changes are counted as soon as they&apos;re added.
      </p>

      {incoming.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">Needs your response</p>
          {incoming.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-secondary/20 bg-secondary-fixed/10 p-4 shadow-sm"
            >
              <p className="font-semibold text-on-surface">{summarize(r)}</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {r.effort_revision_pending
                  ? `${partnerName} wants to change effort · ${Number(r.vp)} → ${Number(r.pending_vp ?? r.vp)} VP if you approve`
                  : `Requested by ${partnerName} · +${Number(r.vp)} VP proposed`}
              </p>
              <div className="mt-2">
                <ProofLinkButton storagePath={r.proof_storage_path} label="View proof photo" />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => onApprove(r.id)}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-50"
                >
                  {busyId === r.id ? "…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => onReject(r.id)}
                  className="flex-1 rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface disabled:opacity-50"
                >
                  {busyId === r.id ? "…" : "Decline"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {outgoing.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Waiting on partner</p>
          {outgoing.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4"
            >
              <p className="font-semibold text-on-surface">{summarize(r)}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{sublineOutgoing(r, partnerName)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
