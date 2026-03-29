import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getWeekStartSunday, toDateKey, formatWeekLabel } from '@/lib/week';
import { theme } from '@/lib/theme';
import type { ContributionRow } from '@/types/db';

type WeekAgg = {
  week_start: string;
  vpA: number;
  vpB: number;
};

export default function HistoryScreen() {
  const { ready, user, profile, partner, household } = useAuth();
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentKey = useMemo(() => toDateKey(getWeekStartSunday()), []);

  const load = useCallback(async () => {
    if (!household?.id) return;
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('household_id', household.id)
      .order('week_start', { ascending: false });
    if (error) {
      console.warn(error.message);
      return;
    }
    setRows((data as ContributionRow[]) ?? []);
  }, [household?.id]);

  useEffect(() => {
    if (!household?.id) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [household?.id, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const weeks = useMemo(() => {
    const idToSlot = new Map<string, 'a' | 'b'>();
    if (profile) idToSlot.set(profile.id, profile.member_slot);
    if (partner) idToSlot.set(partner.id, partner.member_slot);

    const map = new Map<string, WeekAgg>();
    for (const r of rows) {
      if (r.week_start === currentKey) continue;
      const slot = idToSlot.get(r.profile_id);
      if (!slot) continue;
      const cur = map.get(r.week_start) ?? { week_start: r.week_start, vpA: 0, vpB: 0 };
      if (slot === 'a') cur.vpA += Number(r.vp);
      else cur.vpB += Number(r.vp);
      map.set(r.week_start, cur);
    }
    return [...map.values()].sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
  }, [rows, profile, partner, currentKey]);

  if (!isSupabaseConfigured || !ready || !user || !profile || !household) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.balance} />
      }
    >
      <Text style={styles.lead}>
        Completed weeks (everything is still stored — we just group by the week that ended after each
        Sunday midnight).
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : weeks.length === 0 ? (
        <Text style={styles.empty}>No prior weeks yet. Check back after this week wraps.</Text>
      ) : (
        weeks.map((w) => (
          <View key={w.week_start} style={styles.card}>
            <Text style={styles.weekTitle}>{formatWeekLabel(w.week_start)}</Text>
            <Text style={styles.line}>Partner A: {w.vpA.toFixed(w.vpA % 1 === 0 ? 0 : 2)} VP</Text>
            <Text style={styles.line}>Partner B: {w.vpB.toFixed(w.vpB % 1 === 0 ? 0 : 2)} VP</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, backgroundColor: theme.bg },
  lead: { fontSize: 14, color: theme.muted, lineHeight: 20, marginBottom: 12 },
  empty: { fontSize: 15, color: theme.muted, marginTop: 12 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  weekTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 8 },
  line: { fontSize: 15, color: theme.text, marginBottom: 4 },
});
