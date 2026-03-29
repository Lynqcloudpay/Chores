"use client";

import { useState } from "react";
import { ProofLightbox } from "@/components/ProofLightbox";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PROOF_BUCKET } from "@/lib/upload-proof";

type Props = {
  storagePath: string | null | undefined;
  /** Chore: second image (after). */
  afterStoragePath?: string | null | undefined;
  label?: string;
};

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export function ProofLinkButton({ storagePath, afterStoragePath, label = "View proof" }: Props) {
  const [busy, setBusy] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  if (!storagePath) return null;
  const hasAfter = Boolean(afterStoragePath);

  async function open() {
    const path = storagePath;
    if (!path) return;
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        console.warn(error?.message);
        return;
      }
      setIsPdf(isPdfPath(path));
      setSignedUrl(data.signedUrl);
      setLightboxOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setSignedUrl(null);
  }

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void open()}
          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">attach_file</span>
          {busy ? "…" : hasAfter ? "Before" : label}
        </button>
        {hasAfter && afterStoragePath ? (
          <ProofLinkButton storagePath={afterStoragePath} label="After" />
        ) : null}
      </span>
      <ProofLightbox open={lightboxOpen} onClose={closeLightbox} url={signedUrl} isPdf={isPdf} />
    </>
  );
}
