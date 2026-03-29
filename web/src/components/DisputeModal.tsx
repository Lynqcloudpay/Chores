"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProofLightbox } from "@/components/ProofLightbox";
import { PROOF_BUCKET } from "@/lib/upload-proof";
import type { ContributionRow } from "@/types/db";

type Phase = "open" | "resolve";

type Props = {
  row: ContributionRow | null;
  open: boolean;
  phase: Phase | null;
  onClose: () => void;
  partnerName: string;
  onResolved: () => void;
};

/** PostgREST returns PGRST202 when an RPC does not exist (migration not applied on hosted DB). */
function disputeRpcErrorMessage(error: { message: string; code?: string }): string {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (
    code === "PGRST202" ||
    msg === "Not found" ||
    /could not find the function/i.test(msg) ||
    (/open_contribution_dispute|resolve_contribution_dispute/i.test(msg) && /not find|does not exist/i.test(msg))
  ) {
    return "Disputes need database functions that are not on your Supabase project yet. Dashboard → SQL → run the file supabase/migrations/20260329140000_contribution_disputes.sql from this repo (full file), or from the repo: cd web && supabase link && supabase db push.";
  }
  return msg;
}

function summarize(r: ContributionRow): string {
  if (r.kind === "provision" && r.amount_cents != null) {
    return `Financial · $${(r.amount_cents / 100).toFixed(2)} · +${Number(r.vp)} VP`;
  }
  const note = r.note?.trim();
  if (r.kind === "chore" && r.effort) {
    return note ? `${note} · ${r.effort} · +${Number(r.vp)} VP` : `${r.effort} · +${Number(r.vp)} VP`;
  }
  return `+${Number(r.vp)} VP`;
}

export function DisputeModal({ row, open, phase, onClose, partnerName, onResolved }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState(false);
  const [previewAfterUrl, setPreviewAfterUrl] = useState<string | null>(null);
  const [previewAfterPdf, setPreviewAfterPdf] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; isPdf: boolean } | null>(null);

  useEffect(() => {
    if (!open) {
      setNote("");
      setErr(null);
      setPreviewUrl(null);
      setPreviewAfterUrl(null);
      setLightbox(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !row) {
      setPreviewUrl(null);
      setPreviewAfterUrl(null);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    void (async () => {
      if (row.proof_storage_path) {
        const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(row.proof_storage_path, 3600);
        if (!cancelled && !error && data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
          setPreviewPdf(row.proof_storage_path.toLowerCase().endsWith(".pdf"));
        }
      } else {
        setPreviewUrl(null);
      }
      if (row.proof_after_storage_path) {
        const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(row.proof_after_storage_path, 3600);
        if (!cancelled && !error && data?.signedUrl) {
          setPreviewAfterUrl(data.signedUrl);
          setPreviewAfterPdf(row.proof_after_storage_path.toLowerCase().endsWith(".pdf"));
        }
      } else {
        setPreviewAfterUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row?.id, row?.proof_storage_path, row?.proof_after_storage_path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !row || !phase) return null;

  async function submitOpen() {
    if (!row) return;
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("open_contribution_dispute", {
      p_contribution: row.id,
      p_note: note.trim(),
    });
    setBusy(false);
    if (error) {
      setErr(disputeRpcErrorMessage(error));
      return;
    }
    onResolved();
    onClose();
  }

  async function submitResolve(valid: boolean) {
    if (!row) return;
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("resolve_contribution_dispute", {
      p_contribution: row.id,
      p_proof_valid: valid,
    });
    setBusy(false);
    if (error) {
      setErr(disputeRpcErrorMessage(error));
      return;
    }
    onResolved();
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-modal-title"
      >
        <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />

        <div className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl bg-surface-container-lowest shadow-2xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10 sm:rounded-3xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/15 px-4 py-3 sm:px-5">
            <h2 id="dispute-modal-title" className="font-headline text-lg font-bold text-on-surface">
              {phase === "open" ? "Dispute this entry" : "Resolve dispute"}
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
            <p className="text-sm font-semibold text-on-surface">{summarize(row)}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {phase === "open"
                ? `You believe ${partnerName}’s proof may be fraudulent. Weekly VP for this entry is frozen until the dispute is resolved.`
                : `You opened this dispute. If proof was fraudulent, ${partnerName} loses 2× the original VP as a penalty. If proof stands, the entry counts as normal.`}
            </p>

            {row.proof_storage_path || row.proof_after_storage_path ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {previewUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: previewUrl, isPdf: previewPdf })}
                    className="text-sm font-semibold text-primary underline underline-offset-2"
                  >
                    {previewAfterUrl ? "View proof (1 of 2)" : "View attached proof"}
                  </button>
                ) : null}
                {previewAfterUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: previewAfterUrl, isPdf: previewAfterPdf })}
                    className="text-sm font-semibold text-primary underline underline-offset-2"
                  >
                    View second image (legacy)
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-xs text-on-surface-variant">No proof file on this row.</p>
            )}

            {phase === "open" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold text-on-surface">
                  Note (optional)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Why you’re disputing…"
                    className="mt-1 w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50"
                  />
                </label>
                {err ? <p className="text-sm text-red-700 dark:text-red-300">{err}</p> : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitOpen()}
                  className="w-full rounded-full bg-amber-800 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-amber-900"
                >
                  {busy ? "…" : "Open dispute · freeze VP"}
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {err ? <p className="text-sm text-red-700 dark:text-red-300">{err}</p> : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitResolve(true)}
                  className="w-full rounded-full bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-50"
                >
                  {busy ? "…" : "Proof is valid · count VP"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitResolve(false)}
                  className="w-full rounded-full border-2 border-red-700 py-3 text-sm font-bold text-red-800 disabled:opacity-50 dark:border-red-500 dark:text-red-200"
                >
                  {busy ? "…" : "Proof was fraudulent · reject entry & apply 2× penalty"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ProofLightbox
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        url={lightbox?.url ?? null}
        isPdf={lightbox?.isPdf ?? false}
      />
    </>
  );
}
