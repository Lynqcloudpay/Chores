/** 1.5 VP per $1 for Providing (including buy-out / takeout). */
export const VP_PER_DOLLAR = 1.5;

/** Default VP per effort tier for new households (overridable per home with partner approval). */
export const CHORE_VP = {
  high: 50,
  medium: 30,
  low: 15,
} as const;

/** Preset labels by effort — pick one or use a custom description in the modal. */
export const PRESET_CHORES: Record<keyof typeof CHORE_VP, string[]> = {
  low: ["Dishes", "Mail sorting", "Tidying", "Trash out"],
  medium: ["Cooking", "Vacuuming", "Meal prep", "Mopping"],
  high: ["Deep clean", "Yard work", "Major organization", "Repairs", "Laundry"],
};

/** Flat list for onboarding: each chore with a suggested effort (editable by the couple). */
export const SUGGESTED_CHORE_DEFAULTS: { label: string; effort: keyof typeof CHORE_VP }[] = (
  ["low", "medium", "high"] as const
).flatMap((effort) => PRESET_CHORES[effort].map((label) => ({ label, effort })));

type MergeOpts = {
  /**
   * When false, only household labels are used (after onboarding). When true (default), global PRESET_CHORES merge in.
   */
  includeGlobalPresets?: boolean;
};

/** Merge global presets with household-specific labels (e.g. approved custom chores). De-dupes case-insensitively; base order first. */
export function mergedChorePresets(
  effort: keyof typeof CHORE_VP,
  householdExtra: string[] | undefined,
  opts?: MergeOpts,
): string[] {
  const includeGlobal = opts?.includeGlobalPresets !== false;
  const base = includeGlobal ? PRESET_CHORES[effort] : [];
  const extra = householdExtra ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...base, ...extra]) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export type Effort = keyof typeof CHORE_VP;

/** Household row fields; null/absent tier = use CHORE_VP default for that tier. */
export type HouseholdChoreVpFields = {
  chore_vp_low?: number | null;
  chore_vp_medium?: number | null;
  chore_vp_high?: number | null;
};

export function effectiveChoreVp(h: HouseholdChoreVpFields | null | undefined): Record<Effort, number> {
  if (!h) return { ...CHORE_VP };
  return {
    low: h.chore_vp_low ?? CHORE_VP.low,
    medium: h.chore_vp_medium ?? CHORE_VP.medium,
    high: h.chore_vp_high ?? CHORE_VP.high,
  };
}

export function vpFromDollars(dollars: number): number {
  return Math.round(dollars * VP_PER_DOLLAR * 100) / 100;
}

export function vpFromEffort(effort: Effort, tiers: Record<Effort, number> = CHORE_VP): number {
  return tiers[effort];
}

export function contributionGapVp(totalA: number, totalB: number): number {
  return Math.abs(totalA - totalB);
}

export function tiltPercent(totalA: number, totalB: number): number {
  const sum = totalA + totalB;
  if (sum <= 0) return 0;
  return Math.round((contributionGapVp(totalA, totalB) / sum) * 100);
}

export function pathToParityLines(deficitVp: number, tiers: Record<Effort, number> = CHORE_VP): string[] {
  if (deficitVp <= 0) return [];
  const m = Math.ceil(deficitVp / tiers.medium);
  const h = Math.ceil(deficitVp / tiers.high);
  const l = Math.ceil(deficitVp / tiers.low);
  return [
    `${m} medium chore${m === 1 ? "" : "s"} (≈ ${m * tiers.medium} VP)`,
    `${h} high-effort chore${h === 1 ? "" : "s"} (≈ ${h * tiers.high} VP)`,
    `${l} low-effort chore${l === 1 ? "" : "s"} (≈ ${l * tiers.low} VP)`,
  ];
}

export function formatVp(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}
