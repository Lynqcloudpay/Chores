"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProofCaptureModal, isChoreProofPair, type ChoreProofPair } from "@/components/ProofCaptureModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { partnerAskDeadlinePassed, partnerAskTimeRemainingMs } from "@/lib/partner-ask-deadline";
import { uploadContributionProof } from "@/lib/upload-proof";
import type { DelegationRequestRow } from "@/types/db";

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Time’s up";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m to submit proof`;
  if (m > 0) return `${m} min to submit proof`;
  return "Under a minute";
}

type Props = {
  householdId: string;
  weekKey: string;
  userId: string;
  partner: { id: string; display_name: string } | null;
  delegations: DelegationRequestRow[];
  onRefresh: () => Promise<void>;
};

/**
 * Compact partner-ask status: tasks asked of you (with before/after proof) and your open outgoing asks.
 * Creation lives in the + contribution modal — this avoids duplicating the large dashboard explainer.
 */
export function PartnerAskStatus({ householdId, weekKey, userId, partner, delegations, onRefresh }: Props) {
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [completeFor, setCompleteFor] = useState<DelegationRequestRow | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  if (!partner) {
    return (
      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 p-4">
        <p className="text-sm text-on-surface-variant">
          <strong className="text-on-surface">Partner asks</strong> need a second person in your household.{" "}
          <Link href="/account#invite-partner" className="font-semibold text-primary underline underline-offset-2">
            Invite your partner
          </Link>{" "}
          to assign tasks from the <span className="font-semibold text-on-surface">+</span> button.
        </p>
      </section>
    );
  }

  const incoming = delegations.filter((d) => d.assigned_to === userId && d.status === "pending");
  const outgoing = delegations.filter((d) => d.requested_by === userId && d.status === "pending");

  if (incoming.length === 0 && outgoing.length === 0) return null;

  async function cancelRequest(id: string) {
    setCancelBusyId(id);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("cancel_delegation_request", { p_request: id });
    setCancelBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    await onRefresh();
  }

  async function onProofConfirmed(result: ChoreProofPair) {
    if (!completeFor) return;
    if (partnerAskDeadlinePassed(completeFor.created_at)) {
      alert("This partner ask expired — you had 24 hours to submit photo proof.");
      return;
    }
    setCompleteBusy(true);
    const supabase = getSupabaseBrowserClient();
    const contributionId = crypto.randomUUID();
    try {
      const { path: pathBefore } = await uploadContributionProof(
        supabase,
        householdId,
        contributionId,
        result.before.blob,
        result.before.contentType,
        "before",
      );
      const { path: pathAfter } = await uploadContributionProof(
        supabase,
        householdId,
        contributionId,
        result.after.blob,
        result.after.contentType,
        "after",
      );
      const { error: insErr } = await supabase.from("contributions").insert({
        id: contributionId,
        household_id: householdId,
        profile_id: userId,
        kind: "chore",
        effort: completeFor.effort,
        vp: completeFor.base_vp,
        note: `Partner ask: ${completeFor.chore_label}`,
        week_start: weekKey,
        status: "approved",
        chore_source: "preset",
        proof_storage_path: pathBefore,
        proof_captured_at: result.before.capturedAtIso,
        proof_after_storage_path: pathAfter,
        proof_after_captured_at: result.after.capturedAtIso,
      });
      if (insErr) throw insErr;

      const { error: finErr } = await supabase.rpc("finalize_delegation_completion", {
        p_request: completeFor.id,
        p_contribution: contributionId,
      });
      if (finErr) {
        await supabase.from("contributions").delete().eq("id", contributionId);
        throw finErr;
      }

      setProofOpen(false);
      setCompleteFor(null);
      await onRefresh();
    } catch (err) {
      console.warn(err);
      alert(err instanceof Error ? err.message : "Could not complete ask.");
    } finally {
      setCompleteBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-secondary/20 bg-secondary-fixed/5 p-4">
        <h2 className="font-headline text-base font-bold text-on-surface">Open partner asks</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          New requests are sent from the <span className="font-semibold text-on-surface">+</span> menu · before &amp; after
          photos when you mark done.
        </p>

        {incoming.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary">Asked of you</p>
            {incoming.map((d) => {
              const expired = partnerAskDeadlinePassed(d.created_at);
              const remaining = partnerAskTimeRemainingMs(d.created_at);
              return (
                <div key={d.id} className="rounded-xl border border-primary/30 bg-primary-container/10 p-4">
                  <p className="font-semibold text-on-surface">{d.chore_label}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {d.effort} · +{Number(d.base_vp)} VP when done · −{Number(d.penalty_vp)} VP if no proof in 24h
                  </p>
                  <p className="mt-2 text-xs font-semibold text-primary">
                    {expired ? "Deadline passed — penalty applies when someone opens the app." : formatTimeRemaining(remaining)}
                  </p>
                  <button
                    type="button"
                    disabled={completeBusy || expired}
                    onClick={() => {
                      setCompleteFor(d);
                      setProofOpen(true);
                    }}
                    className="mt-3 w-full rounded-full bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-45"
                  >
                    {expired ? "Deadline expired" : "Mark done (before & after)"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {outgoing.length > 0 ? (
          <div className={`space-y-3 ${incoming.length > 0 ? "mt-6" : "mt-4"}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Your open asks</p>
            {outgoing.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-outline-variant/20 p-4">
                <div>
                  <p className="font-semibold text-on-surface">{d.chore_label}</p>
                  <p className="text-sm text-on-surface-variant">
                    {d.effort} · −{Number(d.penalty_vp)} VP if no proof in 24h
                  </p>
                </div>
                <button
                  type="button"
                  disabled={cancelBusyId !== null}
                  onClick={() => void cancelRequest(d.id)}
                  className="shrink-0 text-sm font-semibold text-on-surface-variant underline"
                >
                  {cancelBusyId === d.id ? "…" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <ProofCaptureModal
        open={proofOpen}
        onClose={() => {
          if (!completeBusy) {
            setProofOpen(false);
            setCompleteFor(null);
          }
        }}
        mode="chore"
        onConfirm={(r) => {
          if (isChoreProofPair(r)) void onProofConfirmed(r);
        }}
      />
    </>
  );
}
