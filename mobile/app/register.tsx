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
import { router } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { theme } from '@/lib/theme';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [join, setJoin] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    if (!isSupabaseConfigured) {
      Alert.alert('Setup needed', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    if (!email.trim() || password.length < 6) {
      Alert.alert('Check fields', 'Use a valid email and password (6+ chars).');
      return;
    }
    if (join && !name.trim()) {
      Alert.alert('Display name', 'Enter your name to join with a code.');
      return;
    }
    if (join && code.trim().length < 4) {
      Alert.alert('Invite code', 'Enter the code your partner shared.');
      return;
    }

    setBusy(true);
    const { data: authData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      Alert.alert('Sign up', error.message);
      return;
    }
    const user = authData.user;
    const session = authData.session;
    if (!user) {
      setBusy(false);
      Alert.alert(
        'Confirm email',
        'If your project requires email confirmation, check your inbox then sign in.',
      );
      router.replace('/login');
      return;
    }
    if (!session) {
      setBusy(false);
      Alert.alert(
        'Session required',
        'Disable email confirmation in Supabase (Auth → Email) for testing, or confirm email and sign in first.',
      );
      return;
    }

    try {
      if (!join) {
        router.replace('/setup');
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
          Register your email only. If you don&apos;t have a partner&apos;s code yet, you&apos;ll set up a household on
          the next screen when you&apos;re ready.
        </Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.tab, !join && styles.tabOn]}
            onPress={() => setJoin(false)}
          >
            <Text style={[styles.tabText, !join && styles.tabTextOn]}>No code yet</Text>
          </Pressable>
          <Pressable style={[styles.tab, join && styles.tabOn]} onPress={() => setJoin(true)}>
            <Text style={[styles.tabText, join && styles.tabTextOn]}>Join with code</Text>
          </Pressable>
        </View>
        {join ? (
          <>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              placeholder="Mel"
              placeholderTextColor={theme.muted}
              value={name}
              onChangeText={setName}
            />
          </>
        ) : null}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={theme.muted}
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="At least 6 characters"
          placeholderTextColor={theme.muted}
          value={password}
          onChangeText={setPassword}
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
        <Pressable style={[styles.cta, busy && styles.ctaOff]} onPress={onRegister} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{join ? 'Join household' : 'Create account'}</Text>
          )}
        </Pressable>
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
});
