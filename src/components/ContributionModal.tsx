"use client";

import { useEffect, useState } from "react";
import { CHORE_VP, mergedChorePresets, vpFromDollars, type Effort } from "@/lib/vp";
import { ProofCaptureModal, type ProofCaptureResult } from "@/components/ProofCaptureModal";

const EMPTY_EXTRAS: Record<Effort, string[]> = { low: [], medium: [], high: [] };

type Props = {
  /** Effective VP per effort for this household (defaults: CHORE_VP). */
  choreVp?: Record<Effort, number>;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    kind: "provision" | "chore";
    dollars?: number;
    effort?: Effort;
    note?: string;
    /** Only custom free-text chores need partner approval (effort level confirmation). */
    choreEntryType?: "preset" | "custom";
    proof: ProofCaptureResult;
  }) => Promise<void>;
  busy: boolean;
  partnerName: string;
  /** Household-specific preset labels (e.g. approved custom chores), merged with the global list per effort. */
  householdExtraPresets?: Record<Effort, string[]>;
  /** After onboarding, hide global defaults and use only household rows (+ extras). */
  includeGlobalPresets?: boolean;
};

type Step = "choice" | "financial" | "chore";

const effortOrder: Effort[] = ["low", "medium", "high"];

export function ContributionModal({
  choreVp = CHORE_VP,
  open,
  onClose,
  onSubmit,
  busy,
  partnerName,
  householdExtraPresets,
  includeGlobalPresets = true,
}: Props) {
  const [step, setStep] = useState<Step>("choice");
  const [dollars, setDollars] = useState("");
  const [buyout, setBuyout] = useState(false);
  const [effort, setEffort] = useState<Effort>("medium");
  const [choreMode, setChoreMode] = useState<"preset" | "custom">("preset");
  const [presetLabel, setPresetLabel] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [proofResult, setProofResult] = useState<ProofCaptureResult | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofModalMode, setProofModalMode] = useState<"chore" | "financial">("chore");

  useEffect(() => {
    if (!open) {
      setStep("choice");
      setDollars("");
      setBuyout(false);
      setEffort("medium");
      setChoreMode("preset");
      setPresetLabel(null);
      setCustomNote("");
      setProofResult(null);
      setProofModalOpen(false);
    }
  }, [open]);

  const extras = householdExtraPresets ?? EMPTY_EXTRAS;

  useEffect(() => {
    const presets = mergedChorePresets(effort, extras[effort], { includeGlobalPresets });
    setPresetLabel((cur) => {
      if (cur) {
        const match = presets.find((p) => p.toLowerCase() === cur.trim().toLowerCase());
        if (match) return match;
      }
      return presets[0] ?? null;
    });
  }, [effort, extras, includeGlobalPresets]);

  useEffect(() => {
    setProofResult(null);
  }, [step]);

  if (!open) return null;

  const dollarNum = parseFloat(dollars.replace(",", "."));
  const financialValid = !Number.isNaN(dollarNum) && dollarNum > 0;
  const choreNote =
    choreMode === "preset" ? (presetLabel ?? "").trim() : customNote.trim();
  const choreValid = choreNote.length > 0;

  async function submitFinancial(e: React.FormEvent) {
    e.preventDefault();
    if (!financialValid || !proofResult) return;
    try {
      await onSubmit({
        kind: "provision",
        dollars: dollarNum,
        note: buyout ? "Takeout / buy-out for both" : undefined,
        proof: proofResult,
      });
      onClose();
    } catch {
      /* parent alerts */
    }
  }

  async function submitChore(e: React.FormEvent) {
    e.preventDefault();
    if (!choreValid || !proofResult) return;
    try {
      await onSubmit({
        kind: "chore",
        effort,
        note: choreNote,
        choreEntryType: choreMode,
        proof: proofResult,
      });
      onClose();
    } catch {
      /* parent alerts */
    }
  }

  function proofSummary() {
    if (!proofResult) return null;
    if (proofResult.contentType === "application/pdf") return "PDF attached";
    return "Photo attached · stamped";
  }

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={busy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribution-modal-title"
        className="relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest/95 px-5 py-4 backdrop-blur-md">
          <h2 id="contribution-modal-title" className="font-headline text-lg font-bold text-on-surface">
            {step === "choice" && "New contribution"}
            {step === "financial" && "Financial provision"}
            {step === "chore" && "Chore"}
          </h2>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {step === "choice" ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-on-surface-variant">
                You&apos;ll need a <strong className="text-on-surface">photo or document</strong> for every entry: a
                time-stamped picture for chores, and a receipt or bank statement for money. Financial and preset
                chores still count right away — only <strong className="text-on-surface">custom</strong> chores need{" "}
                <span className="font-semibold text-on-surface">{partnerName}</span> to confirm effort.
              </p>
              <button
                type="button"
                onClick={() => setStep("financial")}
                className="flex w-full items-center gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 text-left transition hover:bg-surface-container-high"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
                  <span className="material-symbols-outlined">payments</span>
                </span>
                <div>
                  <p className="font-headline font-bold text-on-surface">Financial</p>
                  <p className="text-sm text-on-surface-variant">Cash you spent for the household (1.5 VP per $1)</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep("chore")}
                className="flex w-full items-center gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 text-left transition hover:bg-surface-container-high"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-tertiary-fixed/30 text-tertiary">
                  <span className="material-symbols-outlined">mop</span>
                </span>
                <div>
                  <p className="font-headline font-bold text-on-surface">Chore</p>
                  <p className="text-sm text-on-surface-variant">
                    Preset list = instant · Custom text = partner confirms effort
                  </p>
                </div>
              </button>
            </div>
          ) : null}

          {step === "financial" ? (
            <form onSubmit={submitFinancial} className="space-y-6">
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="flex items-center gap-1 text-sm font-semibold text-secondary"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span> Back
              </button>
              <div className="rounded-2xl bg-surface-container-low p-6">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline text-3xl font-bold text-on-surface-variant opacity-40">$</span>
                  <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    className="w-full border-none bg-transparent p-0 font-headline text-4xl font-extrabold text-on-surface placeholder:opacity-25 focus:ring-0"
                    placeholder="0.00"
                    value={dollars}
                    onChange={(e) => setDollars(e.target.value)}
                  />
                </div>
                <p className="mt-4 text-sm text-on-surface-variant">
                  ≈ {financialValid ? vpFromDollars(dollarNum) : "—"} VP toward this week
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-between gap-2 border-t border-outline-variant/10 pt-4 text-sm">
                  <span>Takeout / buy-out (both)</span>
                  <input
                    type="checkbox"
                    checked={buyout}
                    onChange={(e) => setBuyout(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/80 p-4">
                <p className="text-sm font-semibold text-on-surface">Receipt or bank proof (required)</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Photo of a receipt, a screenshot, or a PDF bank statement. Photos get a time stamp when you attach
                  them.
                </p>
                {proofResult ? (
                  <p className="mt-2 text-sm font-medium text-primary">{proofSummary()}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setProofModalMode("financial");
                    setProofModalOpen(true);
                  }}
                  className="mt-3 w-full rounded-full border border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary"
                >
                  {proofResult ? "Change proof" : "Add receipt or bank proof"}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || !financialValid || !proofResult}
                className="w-full rounded-full bg-gradient-to-br from-primary to-primary-container py-4 font-headline font-bold text-on-primary shadow-lg disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add to week"}
              </button>
            </form>
          ) : null}

          {step === "chore" ? (
            <form onSubmit={submitChore} className="space-y-6">
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="flex items-center gap-1 text-sm font-semibold text-secondary"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span> Back
              </button>

              <div>
                <p className="mb-3 text-sm font-semibold text-on-surface">Effort level (VP)</p>
                <div className="grid gap-2">
                  {effortOrder.map((key) => (
                    <label key={key} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="effort"
                        className="peer sr-only"
                        checked={effort === key}
                        onChange={() => setEffort(key)}
                      />
                      <div className="flex items-center justify-between rounded-xl border border-transparent bg-surface-container-low p-4 peer-checked:border-primary/40 peer-checked:bg-primary/5">
                        <span className="font-semibold capitalize text-on-surface">{key}</span>
                        <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-sm font-bold text-primary">
                          {choreVp[key]} VP
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-on-surface">Describe the chore</p>
                {choreMode === "preset" ? (
                  <p className="mb-2 rounded-lg bg-primary-container/15 px-3 py-2 text-xs text-on-primary-container">
                    Predetermined chores: adds to your week immediately. No approval.
                  </p>
                ) : (
                  <p className="mb-2 text-xs text-on-surface-variant">
                    Custom entry: {partnerName} must approve your claimed effort level.
                  </p>
                )}
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChoreMode("preset")}
                    className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                      choreMode === "preset"
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    Pick from list
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoreMode("custom")}
                    className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                      choreMode === "custom"
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {choreMode === "preset" ? (
                  <div className="flex flex-wrap gap-2">
                    {mergedChorePresets(effort, extras[effort], { includeGlobalPresets }).map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setPresetLabel(label)}
                        className={`rounded-full px-4 py-2 text-sm font-medium ${
                          presetLabel === label
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-high text-on-surface"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="mt-1 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    placeholder="What did you do?"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                  />
                )}
              </div>

              <p className="text-center text-sm font-semibold text-primary">
                ≈ {choreVp[effort]} VP ({effort} effort)
                {choreMode === "custom" ? (
                  <span className="block text-xs font-normal text-on-surface-variant">
                    Pending {partnerName}&apos;s OK on this effort level
                  </span>
                ) : null}
              </p>

              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/80 p-4">
                <p className="text-sm font-semibold text-on-surface">Photo proof (required)</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Use the camera — we stamp date and time on the picture when you capture it.
                </p>
                {proofResult ? (
                  <p className="mt-2 text-sm font-medium text-primary">{proofSummary()}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setProofModalMode("chore");
                    setProofModalOpen(true);
                  }}
                  className="mt-3 w-full rounded-full border border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary"
                >
                  {proofResult ? "Change photo" : "Take proof photo"}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || !choreValid || !proofResult}
                className="w-full rounded-full bg-gradient-to-br from-primary to-primary-container py-4 font-headline font-bold text-on-primary shadow-lg disabled:opacity-50"
              >
                {busy
                  ? "Sending…"
                  : choreMode === "custom"
                    ? "Submit for partner approval"
                    : "Add to week"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>

    <ProofCaptureModal
      open={proofModalOpen}
      onClose={() => setProofModalOpen(false)}
      mode={proofModalMode}
      onConfirm={(r) => setProofResult(r)}
    />
    </>
  );
}
