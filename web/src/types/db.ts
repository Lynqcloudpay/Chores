export type MemberSlot = "a" | "b";
export type ContributionKind = "provision" | "chore";
export type EffortLevel = "high" | "medium" | "low";

export type Profile = {
  id: string;
  household_id: string;
  display_name: string;
  member_slot: MemberSlot;
};

export type Household = {
  id: string;
  name: string | null;
  invite_code: string;
  /** Set when the couple finishes the “your chore list” onboarding — picker uses household presets only. */
  chore_presets_onboarded_at?: string | null;
  /** Per-tier VP overrides; null = app default for that tier (15 / 30 / 50). */
  chore_vp_low?: number | null;
  chore_vp_medium?: number | null;
  chore_vp_high?: number | null;
  chore_vp_pending_low?: number | null;
  chore_vp_pending_medium?: number | null;
  chore_vp_pending_high?: number | null;
  chore_vp_pending_requested_by?: string | null;
  /** free | pro — set by Stripe webhook only. */
  subscription_tier?: "free" | "pro" | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  /** Grace access after cancel (ISO). */
  pro_access_until?: string | null;
  /** Optional ZIP/postal for “near you” hire-help map links. */
  service_area_zip?: string | null;
};

export type ContributionStatus = "pending" | "approved" | "rejected";

export type DelegationStatus = "pending" | "completed" | "penalized" | "cancelled";

export type DelegationRequestRow = {
  id: string;
  household_id: string;
  week_start: string;
  requested_by: string;
  assigned_to: string;
  effort: EffortLevel;
  chore_label: string;
  base_vp: number;
  penalty_vp: number;
  status: DelegationStatus;
  completed_contribution_id: string | null;
  penalty_contribution_id: string | null;
  created_at: string;
};

export type HouseholdChorePreset = {
  id: string;
  household_id: string;
  effort: EffortLevel;
  label: string;
  created_at: string;
};

export type ContributionRow = {
  id: string;
  household_id: string;
  profile_id: string;
  kind: ContributionKind;
  amount_cents: number | null;
  effort: EffortLevel | null;
  vp: number;
  note: string | null;
  week_start: string;
  /** Omitted on DBs before partner-approval migration — treated as approved. */
  status?: ContributionStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  /** Chore only: preset vs custom (free-text) — used when promoting approved customs to household presets. */
  chore_source?: "preset" | "custom" | null;
  /** Storage path in `contribution-proofs` bucket (before / primary). */
  proof_storage_path?: string | null;
  proof_captured_at?: string | null;
  /** Chore: optional second image (after). */
  proof_after_storage_path?: string | null;
  proof_after_captured_at?: string | null;
  /** True while a new effort level awaits partner approval (approved chores only). */
  effort_revision_pending?: boolean;
  pending_effort?: EffortLevel | null;
  pending_vp?: number | null;
  /** Partner dispute: VP on hold until resolved_valid; resolved_fraud rejects entry + penalty row. */
  dispute_status?: "open" | "resolved_valid" | "resolved_fraud" | null;
  dispute_opened_by?: string | null;
  dispute_opened_at?: string | null;
  dispute_note?: string | null;
  dispute_resolved_by?: string | null;
  dispute_resolved_at?: string | null;
  created_at: string;
};
