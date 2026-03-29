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
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { theme } from '@/lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    if (!isSupabaseConfigured) {
      Alert.alert('Setup needed', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      Alert.alert('Could not sign in', error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.lead}>Welcome back. Sign in to see your week.</Text>
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
        placeholder="••••••••"
        placeholderTextColor={theme.muted}
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={[styles.cta, busy && styles.ctaOff]} onPress={onLogin} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Sign in</Text>}
      </Pressable>
      <Link href="/register" asChild>
        <Pressable style={styles.linkBtn}>
          <Text style={styles.link}>New here? Create a household or join with a code</Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: theme.bg },
  lead: { fontSize: 16, color: theme.muted, marginBottom: 20, lineHeight: 22 },
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
