"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DisputeModal } from "@/components/DisputeModal";
import { ProofLinkButton } from "@/components/ProofLinkButton";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ContributionRow, Profile } from "@/types/db";

type Props = {
  open: boolean;
  onClose: () => void;
};

function rowSummary(r: ContributionRow): string {
  if (r.kind === "provision" && r.amount_cents != null) {
    return `Financial · $${(r.amount_cents / 100).toFixed(2)} · +${Number(r.vp)} VP`;
  }
  const note = r.note?.trim();
  if (r.kind === "chore" && r.effort) {
    return note ? `${note} · ${r.effort} · +${Number(r.vp)} VP` : `${r.effort} · +${Number(r.vp)} VP`;
  }
  return `+${Number(r.vp)} VP`;
}

export function DisputesCenterModal({ open, onClose }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [disputeModal, setDisputeModal] = useState<{ row: ContributionRow; phase: "open" | "resolve" } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data: prof, error: pErr } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (pErr || !prof?.household_id) {
        setErr(pErr?.message ?? "No household");
        setLoading(false);
        return;
      }
      const hid = prof.household_id;
      const [profRes, dispRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("household_id", hid),
        supabase
          .from("contributions")
          .select("*")
          .eq("household_id", hid)
          .eq("dispute_status", "open")
          .order("created_at", { ascending: false }),
      ]);
      if (profRes.error) setErr(profRes.error.message);
      else setProfiles((profRes.data as Profile[]) ?? []);
      if (dispRes.error) setErr(dispRes.error.message);
      else setRows((dispRes.data as ContributionRow[]) ?? []);
      setLoading(false);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const idToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.display_name);
    return m;
  }, [profiles]);

  const partnerName = useMemo(() => {
    if (!userId) return "Partner";
    const other = profiles.find((p) => p.id !== userId);
    return other?.display_name ?? "Partner";
  }, [profiles, userId]);

  async function refreshAfterResolve() {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const { data: prof } = await supabase.from("profiles").select("household_id").eq("id", userId).maybeSingle();
    const hid = prof?.household_id;
    if (!hid) return;
    const { data, error } = await supabase
      .from("contributions")
      .select("*")
      .eq("household_id", hid)
      .eq("dispute_status", "open")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as ContributionRow[]);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[105] flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disputes-center-title"
      >
        <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />

        <div className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl bg-surface-container-lowest shadow-2xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10 sm:rounded-3xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/15 px-4 py-3 sm:px-5">
            <h2 id="disputes-center-title" className="font-headline text-lg font-bold text-on-surface">
              Disputes
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-sm text-on-surface-variant">
              Open proof disputes freeze VP on that entry until the person who opened the dispute resolves it. To open a
              new dispute, use <strong className="text-on-surface">Dispute proof</strong> on an entry in{" "}
              <Link href="/logs" className="font-semibold text-primary underline underline-offset-2" onClick={onClose}>
                Logs
              </Link>
              .
            </p>

            {loading ? (
              <p className="mt-6 text-sm text-on-surface-variant">Loading…</p>
            ) : err ? (
              <p className="mt-6 text-sm font-medium text-red-700 dark:text-red-300">{err}</p>
            ) : rows.length === 0 ? (
              <p className="mt-6 text-sm text-on-surface-variant">No open disputes right now.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {rows.map((r) => {
                  const mine = r.profile_id === userId;
                  const opener = r.dispute_opened_by === userId;
                  return (
                    <li key={r.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/80 p-4">
                      <p className="text-sm font-semibold text-on-surface">{rowSummary(r)}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Logged by {idToName.get(r.profile_id) ?? "Someone"}
                        {mine ? " (you)" : ""} · opened by {idToName.get(r.dispute_opened_by ?? "") ?? "—"}
                      </p>
                      <div className="mt-2">
                        <ProofLinkButton storagePath={r.proof_storage_path} afterStoragePath={r.proof_after_storage_path} />
                      </div>
                      {opener ? (
                        <button
                          type="button"
                          onClick={() => setDisputeModal({ row: r, phase: "resolve" })}
                          className="mt-3 w-full rounded-full border border-primary/40 bg-primary/10 py-2.5 text-sm font-bold text-primary"
                        >
                          Resolve dispute
                        </button>
                      ) : (
                        <p className="mt-3 text-xs font-medium text-amber-900 dark:text-amber-200">
                          Waiting for the person who opened this dispute to resolve it.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-6 text-center text-xs text-on-surface-variant">
              <Link href="/history" className="font-medium text-primary underline underline-offset-2" onClick={onClose}>
                Past weeks
              </Link>
            </p>
          </div>
        </div>
      </div>

      <DisputeModal
        row={disputeModal?.row ?? null}
        open={disputeModal !== null}
        phase={disputeModal?.phase ?? null}
        onClose={() => setDisputeModal(null)}
        partnerName={partnerName}
        onResolved={() => void refreshAfterResolve()}
      />
    </>
  );
}
