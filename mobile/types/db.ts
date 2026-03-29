export type MemberSlot = 'a' | 'b';

export type ContributionKind = 'provision' | 'chore';

export type EffortLevel = 'high' | 'medium' | 'low';

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
  created_at: string;
};
