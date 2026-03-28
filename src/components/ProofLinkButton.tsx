"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PROOF_BUCKET } from "@/lib/upload-proof";

type Props = {
  storagePath: string | null | undefined;
  label?: string;
};

export function ProofLinkButton({ storagePath, label = "View proof" }: Props) {
  const [busy, setBusy] = useState(false);
  if (!storagePath) return null;

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
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void open()}
      className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[16px]">attach_file</span>
      {busy ? "…" : label}
    </button>
  );
}
