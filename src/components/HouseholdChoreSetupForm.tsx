"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CHORE_VP, SUGGESTED_CHORE_DEFAULTS, type Effort } from "@/lib/vp";

type Row = { key: string; label: string; effort: Effort };

function newRow(label: string, effort: Effort): Row {
  return {
    key: crypto.randomUUID(),
    label,
    effort,
  };
}

function defaultRows(): Row[] {
  return SUGGESTED_CHORE_DEFAULTS.map((s) => newRow(s.label, s.effort));
}

type Props = {
  householdId: string;
  /** Existing presets (e.g. partner started); merged into initial rows by label. */
  initialFromDb?: { effort: Effort; label: string }[];
  onDone: () => void;
};

const effortOrder: Effort[] = ["low", "medium", "high"];

export function HouseholdChoreSetupForm({ householdId, initialFromDb, onDone }: Props) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (initialFromDb && initialFromDb.length > 0) {
      return initialFromDb.map((r) => newRow(r.label.trim(), r.effort));
    }
    return defaultRows();
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const validRows = useMemo(
    () => rows.map((r) => ({ ...r, label: r.label.trim() })).filter((r) => r.label.length > 0),
    [rows],
  );

  function setEffort(key: string, effort: Effort) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, effort } : r)));
  }

  function setLabel(key: string, label: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, label } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow("", "medium")]);
  }

  function resetToSuggestions() {
    setRows(defaultRows());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (validRows.length === 0) {
      setErr("Add at least one chore, or reset to suggestions.");
      return;
    }

    const seen = new Set<string>();
    const deduped: { effort: Effort; label: string }[] = [];
    for (const r of validRows) {
      const k = r.label.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push({ effort: r.effort, label: r.label });
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: delErr } = await supabase
      .from("household_chore_presets")
      .delete()
      .eq("household_id", householdId);
    if (delErr) {
      setErr(delErr.message);
      setBusy(false);
      return;
    }

    const { error: insErr } = await supabase.from("household_chore_presets").insert(
      deduped.map((r) => ({
        household_id: householdId,
        effort: r.effort,
        label: r.label,
      })),
    );
    if (insErr) {
      setErr(insErr.message);
      setBusy(false);
      return;
    }

    const { error: hhErr } = await supabase
      .from("households")
      .update({ chore_presets_onboarded_at: new Date().toISOString() })
      .eq("id", householdId);
    if (hhErr) {
      setErr(hhErr.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 text-left">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Your chore list</h2>
        <p className="mt-2 text-sm text-slate-600">
          We suggest common chores and effort levels — adjust anything so it matches how{" "}
          <strong className="text-slate-800">your</strong> household thinks about them (e.g. laundry as high, or
          dishes as low if you don’t mind them).
        </p>
      </div>

      <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3 sm:flex-row sm:items-center"
          >
            <input
              type="text"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={r.label}
              onChange={(e) => setLabel(r.key, e.target.value)}
              placeholder="Chore name"
            />
            <div className="flex shrink-0 gap-1">
              {effortOrder.map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => setEffort(r.key, eff)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize ${
                    r.effort === eff
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                  title={`${CHORE_VP[eff]} VP`}
                >
                  {eff}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeRow(r.key)}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700"
              aria-label="Remove chore"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Add chore
        </button>
        <button
          type="button"
          onClick={resetToSuggestions}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Reset to suggestions
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Low / medium / high map to {CHORE_VP.low} / {CHORE_VP.medium} / {CHORE_VP.high} VP when you log a preset
        chore.
      </p>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
