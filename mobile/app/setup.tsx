import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router, Link } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { theme } from '@/lib/theme';

function randomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Same as web CompleteSetupForm: create or join a household only when the user chooses. */
export default function SetupScreen() {
  const [name, setName] = useState('');
  const [join, setJoin] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!isSupabaseConfigured) {
      Alert.alert('Setup needed', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Display name', 'Enter your name.');
      return;
    }
    if (join && code.trim().length < 4) {
      Alert.alert('Invite code', 'Enter the code your partner shared.');
      return;
    }

    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      router.replace('/login');
      return;
    }

    try {
      if (!join) {
        const invite = randomInviteCode();
        const { data: hh, error: he } = await supabase
          .from('households')
          .insert({ name: 'Home', invite_code: invite, created_by: user.id })
          .select()
          .single();
        if (he) throw he;
        const { error: pe } = await supabase.from('profiles').insert({
          id: user.id,
          household_id: hh.id,
          display_name: name.trim(),
          member_slot: 'a',
        });
        if (pe) throw pe;
        Alert.alert('Your invite code', `Share with your partner: ${invite}`, [
          { text: 'OK', onPress: () => router.replace('/') },
        ]);
      } else {
        const { data: hid, error: fe } = await supabase.rpc('household_id_by_invite', {
          p_code: code.trim(),
        });
        if (fe) throw fe;
        if (!hid) throw new Error('No household matches that code.');
        const householdId = hid as string;
        const { data: slot, error: se } = await supabase.rpc('next_member_slot', {
          p_household: householdId,
        });
        if (se) throw se;
        if (!slot) throw new Error('That household already has two members.');
        const { error: pe } = await supabase.from('profiles').insert({
          id: user.id,
          household_id: householdId,
          display_name: name.trim(),
          member_slot: slot as 'a' | 'b',
        });
        if (pe) throw pe;
        router.replace('/');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not finish setup.';
      Alert.alert('Setup', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Link your account to a home only when you&apos;re ready — create one and get a code, or join with your
          partner&apos;s code.
        </Text>
        <View style={styles.row}>
          <Pressable style={[styles.tab, !join && styles.tabOn]} onPress={() => setJoin(false)}>
            <Text style={[styles.tabText, !join && styles.tabTextOn]}>Create household</Text>
          </Pressable>
          <Pressable style={[styles.tab, join && styles.tabOn]} onPress={() => setJoin(true)}>
            <Text style={[styles.tabText, join && styles.tabTextOn]}>Join with code</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={theme.muted}
          value={name}
          onChangeText={setName}
        />
        {join ? (
          <>
            <Text style={styles.label}>Invite code</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="characters"
              placeholder="ABC123"
              placeholderTextColor={theme.muted}
              value={code}
              onChangeText={setCode}
            />
          </>
        ) : null}
        <Pressable style={[styles.cta, busy && styles.ctaOff]} onPress={onSubmit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{join ? 'Join household' : 'Create household'}</Text>
          )}
        </Pressable>
        <Link href="/" asChild>
          <Pressable style={styles.linkBtn}>
            <Text style={styles.link}>Back to home</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 15, color: theme.muted, marginBottom: 16, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  tabOn: { borderColor: theme.balance, backgroundColor: theme.balanceSoft },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.muted },
  tabTextOn: { color: theme.balanceText },
  label: { fontSize: 13, fontWeight: '600', color: theme.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    marginBottom: 14,
    backgroundColor: theme.card,
  },
  cta: {
    backgroundColor: theme.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaOff: { opacity: 0.6 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: { marginTop: 20, padding: 8 },
  link: { color: theme.tipB, fontSize: 15, textAlign: 'center' },
});
