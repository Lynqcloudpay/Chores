"use client";

import { useCallback, useState } from "react";
import type { Household, Profile } from "@/types/db";

type Props = {
  profile: Profile;
  partner: Profile | null;
  household: Household;
};

/**
 * Compact welcome — matches dashboard card language (bento / surface). No instructions here.
 */
export function EquityEngineWelcome({ profile, partner, household }: Props) {
  const homeLabel = household.name?.trim() || "Household";
  const code = household.invite_code;
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [code]);

  return (
    <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest bento-shadow" aria-labelledby="welcome-heading">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p id="welcome-heading" className="font-headline text-lg font-bold tracking-tight text-on-surface sm:text-xl">
          Hi, {profile.display_name}
          {partner ? <span className="font-semibold text-on-surface-variant"> · with {partner.display_name}</span> : null}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">{homeLabel}</p>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-outline-variant/15 bg-surface-bright/80 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">Invite</p>
            <p className="font-mono text-sm font-semibold tracking-[0.08em] text-on-surface">{code}</p>
          </div>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-3.5 text-on-primary transition active:scale-[0.98]"
            aria-label={copied ? "Copied" : "Copy invite code"}
          >
            <span className="material-symbols-outlined text-[20px]">{copied ? "check" : "content_copy"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
