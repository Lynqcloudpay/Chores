"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Effort } from "@/lib/vp";
import type { HouseholdChorePreset } from "@/types/db";

const EFFORT_ORDER: Effort[] = ["low", "medium", "high"];

type Props = {
  householdId: string;
  onSaved: () => Promise<void>;
};

export function ChorePresetsEditor({ householdId, onSaved }: Props) {
  const [rows, setRows] = useState<HouseholdChorePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("household_chore_presets")
      .select("*")
      .eq("household_id", householdId)
      .order("effort")
      .order("label");
    setLoading(false);
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows((data as HouseholdChorePreset[]) ?? []);
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(r: HouseholdChorePreset) {
    setEditingId(r.id);
    setDraft(r.label);
    setErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
    setErr(null);
  }

  async function saveEdit(id: string) {
    const t = draft.trim();
    if (t.length < 1) {
      setErr("Label can’t be empty.");
      return;
    }
    if (t.length > 120) {
      setErr("Keep labels under 120 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("household_chore_presets").update({ label: t }).eq("id", id);
    setBusy(false);
    if (error) {
      if (error.code === "23505") {
        setErr("You already have that chore name for this effort level.");
      } else {
        setErr(error.message);
      }
      return;
    }
    setEditingId(null);
    setDraft("");
    await load();
    await onSaved();
  }

  async function removeRow(id: string) {
    if (!window.confirm("Remove this saved shortcut from your list?")) return;
    setBusy(true);
    setErr(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("household_chore_presets").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditingId(null);
    await load();
    await onSaved();
  }

  const byEffort = EFFORT_ORDER.map((e) => ({
    effort: e,
    items: rows.filter((r) => r.effort === e),
  }));

  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/60 p-5">
      <h2 className="font-headline text-base font-bold text-on-surface">Saved chore shortcuts</h2>
      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
        Names from your setup list and promoted customs. Rename them anytime — they appear in the{" "}
        <span className="font-semibold text-on-surface">+</span> chore picker and the legend on Home.
      </p>

      {loading ? <p className="mt-4 text-sm text-on-surface-variant">Loading…</p> : null}
      {err ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{err}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-on-surface-variant">
          No saved shortcuts yet. Finish chore onboarding or log custom chores your partner approves — they&apos;ll show up
          here to edit.
        </p>
      ) : null}

      <div className="mt-4 space-y-5">
        {byEffort.map(({ effort, items }) =>
          items.length === 0 ? null : (
            <div key={effort}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{effort}</p>
              <ul className="mt-2 space-y-2">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-lowest/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingId === r.id ? (
                      <>
                        <input
                          type="text"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                          maxLength={120}
                          autoFocus
                        />
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveEdit(r.id)}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancelEdit}
                            className="rounded-full border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-on-surface">{r.label}</span>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(r)}
                            className="rounded-full border border-outline-variant/35 px-4 py-1.5 text-xs font-bold text-primary"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeRow(r.id)}
                            className="rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant underline"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
