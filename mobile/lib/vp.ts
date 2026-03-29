/** 1.5 VP per $1 for Providing (including buy-out / takeout). */
export const VP_PER_DOLLAR = 1.5;

export const CHORE_VP = {
  high: 50,
  medium: 30,
  low: 15,
} as const;

export type Effort = keyof typeof CHORE_VP;

export function vpFromDollars(dollars: number): number {
  return Math.round(dollars * VP_PER_DOLLAR * 100) / 100;
}

export function vpFromEffort(effort: Effort): number {
  return CHORE_VP[effort];
}

/** VP the trailing partner needs to tie the leader. */
export function contributionGapVp(totalA: number, totalB: number): number {
  return Math.abs(totalA - totalB);
}

/** 0–100: imbalance as a share of combined VP. */
export function tiltPercent(totalA: number, totalB: number): number {
  const sum = totalA + totalB;
  if (sum <= 0) return 0;
  return Math.round((contributionGapVp(totalA, totalB) / sum) * 100);
}

/** Human-readable ways to cover the contribution gap with chores. */
export function pathToParityLines(deficitVp: number): string[] {
  if (deficitVp <= 0) return [];
  const m = Math.ceil(deficitVp / CHORE_VP.medium);
  const h = Math.ceil(deficitVp / CHORE_VP.high);
  const l = Math.ceil(deficitVp / CHORE_VP.low);
  return [
    `${m} medium chore${m === 1 ? '' : 's'} (≈ ${m * CHORE_VP.medium} VP)`,
    `${h} high-effort chore${h === 1 ? '' : 's'} (≈ ${h * CHORE_VP.high} VP)`,
    `${l} low-effort chore${l === 1 ? '' : 's'} (≈ ${l * CHORE_VP.low} VP)`,
  ];
}

export function formatVp(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}
