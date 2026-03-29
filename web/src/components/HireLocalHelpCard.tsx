"use client";

import { useEffect, useState } from "react";
import { VP_PER_DOLLAR, vpFromDollars } from "@/lib/vp";

type Category = {
  label: string;
  /** Prefills the financial entry note. */
  logNote: string;
  /** Maps search terms (ZIP or “near me” appended). */
  mapsQuery: string;
};

const CATEGORIES: Category[] = [
  { label: "House cleaning", logNote: "Outsourced: House cleaning", mapsQuery: "house cleaning services" },
  { label: "Laundry / dry cleaning", logNote: "Outsourced: Laundry / dry cleaning", mapsQuery: "laundry dry cleaning" },
  { label: "Handyman / repairs", logNote: "Outsourced: Handyman / repairs", mapsQuery: "handyman home repair" },
  { label: "Meals / groceries", logNote: "Outsourced: Meals / groceries delivery", mapsQuery: "meal prep grocery delivery" },
];

function mapsSearchUrl(zipTrimmed: string, mapsQuery: string): string {
  const near = zipTrimmed.length >= 3 ? zipTrimmed : "near me";
  const q = `${mapsQuery} ${near}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

type Props = {
  visible: boolean;
  deficitVp: number;
  serviceAreaZip: string;
  onSaveZip: (zip: string) => Promise<void>;
  onLogPayment: (suggestedNote: string) => void;
};

export function HireLocalHelpCard({ visible, deficitVp, serviceAreaZip, onSaveZip, onLogPayment }: Props) {
  const [zipDraft, setZipDraft] = useState(serviceAreaZip);
  const [zipBusy, setZipBusy] = useState(false);

  useEffect(() => {
    setZipDraft(serviceAreaZip);
  }, [serviceAreaZip]);

  if (!visible) return null;

  const zipTrimmed = zipDraft.trim();

  async function saveZip() {
    setZipBusy(true);
    try {
      await onSaveZip(zipTrimmed);
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-secondary/25 bg-secondary-fixed/10 p-4 sm:p-5">
      <h2 className="font-headline text-lg font-bold text-on-background">Catch up by hiring help</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
        You’re behind on VP — paying for cleaning, laundry, or similar still counts as contribution. VP matches other
        financial entries: <span className="font-semibold text-on-surface">{vpFromDollars(1)} VP per $1</span> (e.g.{" "}
        <span className="tabular-nums">{vpFromDollars(80)} VP</span> on an $80 receipt). Attach the receipt like any
        financial entry.
      </p>
      {deficitVp > 0 ? (
        <p className="mt-2 text-[12px] text-on-surface-variant">
          Rough gap to parity: <span className="font-semibold tabular-nums text-on-surface">{deficitVp.toFixed(0)} VP</span>{" "}
          — or spend about{" "}
          <span className="font-semibold tabular-nums text-on-surface">${(deficitVp / VP_PER_DOLLAR).toFixed(0)}</span> on services
          for similar VP (your household rules still apply).
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-semibold text-on-surface">
          ZIP / postal (better local results)
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="e.g. 10001"
              value={zipDraft}
              onChange={(e) => setZipDraft(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
            />
            <button
              type="button"
              disabled={zipBusy || zipTrimmed === (serviceAreaZip ?? "").trim()}
              onClick={() => void saveZip()}
              className="shrink-0 rounded-full border border-outline-variant/35 bg-surface-container-low px-4 py-2 text-xs font-bold text-primary disabled:opacity-50"
            >
              {zipBusy ? "…" : "Save"}
            </button>
          </div>
        </label>
      </div>

      <ul className="mt-4 space-y-2">
        {CATEGORIES.map((c) => (
          <li
            key={c.mapsQuery}
            className="flex flex-col gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-low/60 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface">{c.label}</p>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">Search nearby, then log what you paid.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={mapsSearchUrl(zipTrimmed, c.mapsQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
              >
                Find near you
              </a>
              <button
                type="button"
                onClick={() => onLogPayment(c.logNote)}
                className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary"
              >
                Log payment
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
