/** Partner ask must be completed with photo proof within 24h of the request (matches DB). */
export const PARTNER_ASK_DEADLINE_MS = 24 * 60 * 60 * 1000;

export function partnerAskDeadlineMs(createdAtIso: string): number {
  return new Date(createdAtIso).getTime() + PARTNER_ASK_DEADLINE_MS;
}

export function partnerAskDeadlinePassed(createdAtIso: string): boolean {
  return Date.now() >= partnerAskDeadlineMs(createdAtIso);
}

export function partnerAskTimeRemainingMs(createdAtIso: string): number {
  return Math.max(0, partnerAskDeadlineMs(createdAtIso) - Date.now());
}
