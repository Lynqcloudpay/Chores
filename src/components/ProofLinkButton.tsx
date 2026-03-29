"use client";

import { useState } from "react";
import { ProofLightbox } from "@/components/ProofLightbox";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PROOF_BUCKET } from "@/lib/upload-proof";

type Props = {
  /** Primary proof path (current single-photo flow). */
  storagePath: string | null | undefined;
  /** Legacy second image only — older rows; not required for new entries. */
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

  const primary = storagePath?.trim() || null;
  const secondary = afterStoragePath?.trim() || null;
  /** Prefer primary; if only legacy `proof_after_*` is set, still show one link. */
  const mainPath = primary ?? secondary;
  const legacySecond = primary && secondary ? secondary : null;

  if (!mainPath) return null;

  async function open(path: string) {
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
          onClick={() => void open(mainPath)}
          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">attach_file</span>
          {busy ? "…" : label}
        </button>
        {legacySecond ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void open(legacySecond)}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
          >
            Second image (legacy)
          </button>
        ) : null}
      </span>
      <ProofLightbox open={lightboxOpen} onClose={closeLightbox} url={signedUrl} isPdf={isPdf} />
    </>
  );
}
