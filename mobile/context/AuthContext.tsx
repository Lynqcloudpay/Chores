import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Household, Profile } from '@/types/db';

type AuthContextValue = {
  ready: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  household: Household | null;
  partner: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  configured: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadHouseholdData(userId: string) {
  const { data: prof, error: pe } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (pe) throw pe;
  if (!prof) {
    return { profile: null as Profile | null, household: null as Household | null, partner: null as Profile | null };
  }
  const { data: hh, error: he } = await supabase
    .from('households')
    .select('*')
    .eq('id', prof.household_id)
    .single();
  if (he) throw he;
  const { data: others, error: oe } = await supabase
    .from('profiles')
    .select('*')
    .eq('household_id', prof.household_id)
    .neq('id', userId);
  if (oe) throw oe;
  const partner = (others?.[0] as Profile | undefined) ?? null;
  return {
    profile: prof as Profile,
    household: hh as Household,
    partner,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      setHousehold(null);
      setPartner(null);
      return;
    }
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (!s?.user) {
      setProfile(null);
      setHousehold(null);
      setPartner(null);
      return;
    }
    try {
      const row = await loadHouseholdData(s.user.id);
      setProfile(row.profile);
      setHousehold(row.household);
      setPartner(row.partner);
    } catch {
      setProfile(null);
      setHousehold(null);
      setPartner(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setReady(true);
        return;
      }
      await refresh();
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      setSession(sess);
      if (!sess?.user) {
        setProfile(null);
        setHousehold(null);
        setPartner(null);
        return;
      }
      try {
        const row = await loadHouseholdData(sess.user.id);
        setProfile(row.profile);
        setHousehold(row.household);
        setPartner(row.partner);
      } catch {
        setProfile(null);
        setHousehold(null);
        setPartner(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setHousehold(null);
    setPartner(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user: session?.user ?? null,
      session,
      profile,
      household,
      partner,
      refresh,
      signOut,
      configured: isSupabaseConfigured,
    }),
    [ready, session, profile, household, partner, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
