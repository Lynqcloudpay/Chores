import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Redirect, Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getWeekStartSunday, toDateKey } from '@/lib/week';
import { vpFromDollars, vpFromEffort, type Effort } from '@/lib/vp';
import { BalanceScale } from '@/components/BalanceScale';
import { EquitySummary } from '@/components/EquitySummary';
import { PathToParity } from '@/components/PathToParity';
import { LogContribution } from '@/components/LogContribution';
import { theme } from '@/lib/theme';
import type { ContributionRow } from '@/types/db';

export default function HomeScreen() {
  const { ready, user, profile, partner, household, refresh, signOut, configured } = useAuth();
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const weekKey = useMemo(() => toDateKey(getWeekStartSunday()), []);

  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('household_id', household.id)
      .eq('week_start', weekKey)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn(error.message);
      return;
    }
    setRows((data as ContributionRow[]) ?? []);
  }, [household?.id, weekKey]);

  useEffect(() => {
    if (!household?.id) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [household?.id, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    await refresh();
    setRefreshing(false);
  }, [load, refresh]);

  const { nameA, nameB, vpA, vpB, behindName, deficit } = useMemo(() => {
    const bySlot = (s: 'a' | 'b') => {
      if (profile?.member_slot === s) return profile.display_name;
      if (partner?.member_slot === s) return partner.display_name;
      return s === 'a' ? 'Partner A' : 'Partner B';
    };
    const labelA = bySlot('a');
    const labelB = bySlot('b');

    let a = 0;
    let b = 0;
    const idToSlot = new Map<string, 'a' | 'b'>();
    if (profile) idToSlot.set(profile.id, profile.member_slot);
    if (partner) idToSlot.set(partner.id, partner.member_slot);

    for (const r of rows) {
      const slot = idToSlot.get(r.profile_id);
      if (!slot) continue;
      if (slot === 'a') a += Number(r.vp);
      else b += Number(r.vp);
    }

    const gap = Math.abs(a - b);
    const behind =
      a < b ? labelA : b < a ? labelB : null;

    return {
      nameA: labelA,
      nameB: labelB,
      vpA: a,
      vpB: b,
      behindName: behind,
      deficit: gap,
    };
  }, [rows, profile, partner]);

  async function handleLog(payload: {
    kind: 'provision' | 'chore';
    dollars?: number;
    effort?: Effort;
    note?: string;
  }) {
    if (!profile || !household || !user) return;
    const vp =
      payload.kind === 'provision' && payload.dollars != null
        ? vpFromDollars(payload.dollars)
        : payload.kind === 'chore' && payload.effort
          ? vpFromEffort(payload.effort)
          : 0;
    if (vp <= 0) return;

    setSubmitting(true);
    const { error } = await supabase.from('contributions').insert({
      household_id: household.id,
      profile_id: user.id,
      kind: payload.kind,
      amount_cents:
        payload.kind === 'provision' && payload.dollars != null
          ? Math.round(payload.dollars * 100)
          : null,
      effort: payload.kind === 'chore' ? payload.effort ?? null : null,
      vp,
      note: payload.note ?? null,
      week_start: weekKey,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await load();
    await refresh();
  }

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.setupTitle}>Connect Supabase</Text>
        <Text style={styles.setupBody}>
          Create a project at supabase.com, run the SQL in `supabase/schema.sql`, then add to{' '}
          <Text style={styles.mono}>.env</Text>:
          {'\n\n'}
          EXPO_PUBLIC_SUPABASE_URL=…{'\n'}
          EXPO_PUBLIC_SUPABASE_ANON_KEY=…
        </Text>
        <Text style={styles.setupHint}>
          Restart Expo after changing env. Build for device with Expo prebuild or EAS Build for
          App Store / Play Store binaries.
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!profile || !household) {
    return <Redirect href="/setup" />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.balance} />
      }
    >
      <View style={styles.topRow}>
        <Text style={styles.invite}>
          {household.invite_code ? `Household code: ${household.invite_code}` : ''}
        </Text>
        <View style={styles.nav}>
          <Link href="/history" asChild>
            <Pressable style={styles.navBtn}>
              <Text style={styles.navTxt}>History</Text>
            </Pressable>
          </Link>
          <Pressable onPress={() => signOut()} style={styles.navBtn}>
            <Text style={styles.navTxt}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} />
      ) : (
        <>
          <BalanceScale nameA={nameA} nameB={nameB} vpA={vpA} vpB={vpB} />
          <View style={styles.gap} />
          <EquitySummary nameA={nameA} nameB={nameB} vpA={vpA} vpB={vpB} />
          <View style={styles.gap} />
          <PathToParity behindName={behindName} deficitVp={deficit} />
          <View style={styles.gap} />
          <LogContribution onSubmit={handleLog} busy={submitting} />
          <Text style={styles.footer}>
            Weeks start Sunday at midnight (local time). Past weeks stay in History — same records,
            grouped by week.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  setupTitle: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 12 },
  setupBody: { fontSize: 15, lineHeight: 22, color: theme.muted },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  setupHint: { marginTop: 16, fontSize: 13, lineHeight: 18, color: theme.muted },
  topRow: { marginBottom: 12, gap: 8 },
  invite: { fontSize: 13, color: theme.muted, fontWeight: '600' },
  nav: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  navBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  navTxt: { color: theme.tipB, fontSize: 15, fontWeight: '600' },
  gap: { height: 12 },
  footer: { marginTop: 20, fontSize: 12, color: theme.muted, lineHeight: 18 },
});
