import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

type Props = {
  nameA: string;
  nameB: string;
  vpA: number;
  vpB: number;
};

export function BalanceScale({ nameA, nameB, vpA, vpB }: Props) {
  const sum = vpA + vpB;
  const ratioA = sum > 0 ? vpA / sum : 0.5;
  const ratioB = sum > 0 ? vpB / sum : 0.5;
  const flexA = Math.max(ratioA, 0.08);
  const flexB = Math.max(ratioB, 0.08);
  const balanced = sum === 0 || Math.abs(vpA - vpB) < 0.01;
  const aAhead = vpA > vpB + 0.01;
  const bAhead = vpB > vpA + 0.01;
  const barA = balanced ? theme.balanceSoft : aAhead ? theme.tipASoft : theme.tipBSoft;
  const barB = balanced ? theme.balanceSoft : bAhead ? theme.tipASoft : theme.tipBSoft;
  const borderA = balanced ? theme.balance : aAhead ? theme.tipA : theme.tipB;
  const borderB = balanced ? theme.balance : bAhead ? theme.tipA : theme.tipB;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>This week&apos;s balance</Text>
      <View style={styles.beam}>
        <View style={[styles.pan, { flex: flexA, borderColor: borderA, backgroundColor: barA }]}>
          <Text style={styles.panName} numberOfLines={1}>
            {nameA}
          </Text>
          <Text style={styles.panVp}>{vpA.toFixed(vpA % 1 === 0 ? 0 : 2)} VP</Text>
        </View>
        <View style={styles.fulcrum} />
        <View style={[styles.pan, { flex: flexB, borderColor: borderB, backgroundColor: barB }]}>
          <Text style={styles.panName} numberOfLines={1}>
            {nameB}
          </Text>
          <Text style={styles.panVp}>{vpB.toFixed(vpB % 1 === 0 ? 0 : 2)} VP</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {balanced
          ? 'You’re in balance — nice work supporting each other.'
          : 'The scale reflects this week’s Value Points so far.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
  beam: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 88,
    gap: 8,
  },
  fulcrum: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: theme.muted,
    opacity: 0.35,
    borderRadius: 2,
  },
  pan: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    justifyContent: 'center',
  },
  panName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  panVp: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  hint: {
    marginTop: 12,
    fontSize: 13,
    color: theme.muted,
    lineHeight: 18,
  },
});
