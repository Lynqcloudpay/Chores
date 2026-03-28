"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Signed URL from storage */
  url: string | null;
  isPdf: boolean;
};

export function ProofLightbox({ open, onClose, url, isPdf }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !url) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Proof preview"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/15 px-3 py-2.5 sm:px-4">
          <p className="text-sm font-semibold text-on-surface">Proof</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-black/5 dark:bg-black/20">
          {isPdf ? (
            <iframe title="Proof PDF" src={url} className="h-[min(85dvh,800px)] w-full border-0 bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from storage
            <img src={url} alt="Contribution proof" className="mx-auto max-h-[min(85dvh,800px)] w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}
