import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { CHORE_VP, vpFromDollars, type Effort } from '@/lib/vp';
import { theme } from '@/lib/theme';

type Mode = 'provision' | 'chore';

type Props = {
  onSubmit: (payload: {
    kind: 'provision' | 'chore';
    dollars?: number;
    effort?: Effort;
    note?: string;
  }) => Promise<void>;
  busy?: boolean;
};

const EFFORTS: { key: Effort; label: string; hint: string }[] = [
  { key: 'high', label: 'High', hint: 'Deep clean, yard work' },
  { key: 'medium', label: 'Medium', hint: 'Cooking, groceries' },
  { key: 'low', label: 'Low', hint: 'Dishes, trash, laundry' },
];

export function LogContribution({ onSubmit, busy }: Props) {
  const [mode, setMode] = useState<Mode>('chore');
  const [dollars, setDollars] = useState('');
  const [effort, setEffort] = useState<Effort>('medium');
  const [buyout, setBuyout] = useState(false);

  async function submit() {
    if (mode === 'provision') {
      const n = parseFloat(dollars.replace(',', '.'));
      if (Number.isNaN(n) || n <= 0) return;
      await onSubmit({
        kind: 'provision',
        dollars: n,
        note: buyout ? 'Takeout / buy-out for both' : undefined,
      });
      setDollars('');
      setBuyout(false);
      return;
    }
    await onSubmit({ kind: 'chore', effort });
  }

  const previewVp =
    mode === 'provision'
      ? (() => {
          const n = parseFloat(dollars.replace(',', '.'));
          if (Number.isNaN(n) || n <= 0) return null;
          return vpFromDollars(n);
        })()
      : CHORE_VP[effort];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Log something</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Chore</Text>
        <Switch
          value={mode === 'provision'}
          onValueChange={(v) => setMode(v ? 'provision' : 'chore')}
          trackColor={{ false: theme.border, true: theme.balance }}
        />
        <Text style={styles.toggleLabel}>Provision ($)</Text>
      </View>

      {mode === 'provision' ? (
        <>
          <Text style={styles.fieldLabel}>Amount (USD)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.muted}
            value={dollars}
            onChangeText={setDollars}
          />
          <View style={styles.buyoutRow}>
            <Text style={styles.buyoutText}>Takeout / buy-out (both)</Text>
            <Switch value={buyout} onValueChange={setBuyout} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Effort level</Text>
          <View style={styles.efforts}>
            {EFFORTS.map((e) => {
              const on = effort === e.key;
              return (
                <Pressable
                  key={e.key}
                  onPress={() => setEffort(e.key)}
                  style={[styles.effortBtn, on && styles.effortBtnOn]}
                >
                  <Text style={[styles.effortLbl, on && styles.effortLblOn]}>{e.label}</Text>
                  <Text style={styles.effortHint}>{e.hint}</Text>
                  <Text style={styles.effortVp}>{CHORE_VP[e.key]} VP</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {previewVp != null && (
        <Text style={styles.preview}>≈ {previewVp} VP this entry</Text>
      )}

      <Pressable
        style={[styles.cta, busy && styles.ctaDisabled]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>Add to this week</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 15,
    color: theme.text,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: theme.text,
    marginBottom: 8,
  },
  buyoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  buyoutText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
    paddingRight: 8,
  },
  efforts: {
    gap: 8,
  },
  effortBtn: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.bg,
  },
  effortBtnOn: {
    borderColor: theme.balance,
    backgroundColor: theme.balanceSoft,
  },
  effortLbl: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  effortLblOn: {
    color: theme.balanceText,
  },
  effortHint: {
    fontSize: 13,
    color: theme.muted,
    marginTop: 2,
  },
  effortVp: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 4,
  },
  preview: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.balanceText,
  },
  cta: {
    marginTop: 16,
    backgroundColor: theme.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
