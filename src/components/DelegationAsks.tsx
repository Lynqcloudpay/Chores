"use client";

import { useEffect, useState } from "react";
import { ProofCaptureModal, type ProofCaptureResult } from "@/components/ProofCaptureModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { partnerAskDeadlinePassed, partnerAskTimeRemainingMs } from "@/lib/partner-ask-deadline";
import { uploadContributionProof } from "@/lib/upload-proof";
import type { DelegationRequestRow } from "@/types/db";
import { type Effort } from "@/lib/vp";

const EFFORTS: Effort[] = ["low", "medium", "high"];

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
  /** Effective VP per tier (household may override defaults). */
  choreVp: Record<Effort, number>;
  householdId: string;
  weekKey: string;
  userId: string;
  partner: { id: string; display_name: string };
  delegations: DelegationRequestRow[];
  canSendAsk: boolean;
  myVpThisWeek: number;
  partnerVpThisWeek: number;
  onRefresh: () => Promise<void>;
};

export function DelegationAsks({
  choreVp,
  householdId,
  weekKey,
  userId,
  partner,
  delegations,
  canSendAsk,
  myVpThisWeek,
  partnerVpThisWeek,
  onRefresh,
}: Props) {
  const [label, setLabel] = useState("");
  const [effort, setEffort] = useState<Effort>("medium");
  const [createBusy, setCreateBusy] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [completeFor, setCompleteFor] = useState<DelegationRequestRow | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  /** Re-render countdown ~every 30s */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const partnerName = partner.display_name;

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!canSendAsk) return;
    const t = label.trim();
    if (t.length < 1) return;
    setCreateBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("create_delegation_request", {
      p_assigned_to: partner.id,
      p_effort: effort,
      p_chore_label: t,
      p_week_start: weekKey,
    });
    setCreateBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setLabel("");
    await onRefresh();
  }

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

  async function onProofConfirmed(proof: ProofCaptureResult) {
    if (!completeFor) return;
    if (partnerAskDeadlinePassed(completeFor.created_at)) {
      alert("This partner ask expired — you had 24 hours to submit photo proof.");
      return;
    }
    setCompleteBusy(true);
    const supabase = getSupabaseBrowserClient();
    const contributionId = crypto.randomUUID();
    try {
      const { path } = await uploadContributionProof(
        supabase,
        householdId,
        contributionId,
        proof.blob,
        proof.contentType,
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
        proof_storage_path: path,
        proof_captured_at: proof.capturedAtIso,
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

  const incoming = delegations.filter((d) => d.assigned_to === userId && d.status === "pending");
  const outgoing = delegations.filter((d) => d.requested_by === userId && d.status === "pending");

  return (
    <>
      <section className="rounded-2xl border border-secondary/25 bg-secondary-fixed/5 p-5">
        <h2 className="font-headline text-lg font-bold text-on-surface">Partner asks</h2>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          The partner who is <strong className="text-on-surface">ahead in VP this week</strong> (not tied) can request a
          chore from the partner who <strong className="text-on-surface">owes</strong> (less VP). The assignee must
          upload <strong className="text-on-surface">photo proof</strong> within <strong className="text-on-surface">24 hours</strong>{" "}
          or get a <strong className="text-on-surface">2×</strong> VP penalty.
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">
          Your VP: <strong className="text-on-surface">{myVpThisWeek.toFixed(1)}</strong> · {partnerName}:{" "}
          <strong className="text-on-surface">{partnerVpThisWeek.toFixed(1)}</strong>
        </p>

        <div className="mt-4 rounded-2xl border border-secondary/35 bg-gradient-to-br from-secondary-fixed/20 to-primary/10 p-4 shadow-sm">
          <p className="text-sm font-bold text-on-surface">
            {canSendAsk
              ? `${partnerName} owes the balance — assign a task below`
              : `Request a task from ${partnerName}`}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {canSendAsk
              ? "They’ll have 24 hours to submit photo proof."
              : `You need more VP than ${partnerName} this week (no ties) to send an ask. Your VP: ${myVpThisWeek.toFixed(1)} · theirs: ${partnerVpThisWeek.toFixed(1)}.`}
          </p>
          <button
            type="button"
            className={`mt-3 w-full rounded-full py-3.5 text-sm font-bold shadow-sm active:scale-[0.99] ${
              canSendAsk
                ? "bg-secondary text-on-secondary-container"
                : "border-2 border-secondary/50 bg-surface-container-lowest/80 text-on-surface"
            }`}
            onClick={() =>
              document.getElementById("partner-ask-form")?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            Request task from {partnerName}
          </button>
        </div>

        <form
          id="partner-ask-form"
          onSubmit={createRequest}
          className="mt-4 space-y-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-4"
        >
            <p className="text-sm font-semibold text-on-surface">Ask {partnerName} to do</p>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Dishes, litter box, groceries"
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50"
              maxLength={200}
            />
            <div className="flex flex-wrap gap-2">
              {EFFORTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEffort(e)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                    effort === e ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"
                  }`}
                >
                  {e} ({choreVp[e]} VP)
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant">
              If not done with proof in 24h: −{choreVp[effort] * 2} VP for {partnerName}.
            </p>
            <button
              type="submit"
              disabled={createBusy || !canSendAsk || label.trim().length < 1}
              className="w-full rounded-full bg-secondary py-3 text-sm font-bold text-on-secondary-container disabled:opacity-50"
            >
              {createBusy
                ? "Sending…"
                : !canSendAsk
                  ? "Earn more VP than partner to send"
                  : `Send ask (${choreVp[effort]} VP · ${choreVp[effort] * 2} VP penalty after 24h)`}
            </button>
          </form>

        {incoming.length > 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary">Asked of you</p>
            {incoming.map((d) => {
              const expired = partnerAskDeadlinePassed(d.created_at);
              const remaining = partnerAskTimeRemainingMs(d.created_at);
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-primary/30 bg-primary-container/10 p-4"
                >
                  <p className="font-semibold text-on-surface">{d.chore_label}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {d.effort} · +{Number(d.base_vp)} VP when done · −{Number(d.penalty_vp)} VP if no proof in 24h
                  </p>
                  <p className="mt-2 text-xs font-semibold text-primary">
                    {expired
                      ? "Deadline passed — penalty applies when someone opens the app."
                      : formatTimeRemaining(remaining)}
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
                    {expired ? "Deadline expired" : "Mark done (photo proof)"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {outgoing.length > 0 ? (
          <div className="mt-6 space-y-3">
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
        onConfirm={(r) => void onProofConfirmed(r)}
      />
    </>
  );
}
