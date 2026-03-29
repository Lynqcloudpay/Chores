import { Text, StyleSheet, View } from 'react-native';
import { contributionGapVp, tiltPercent, formatVp } from '@/lib/vp';
import { theme } from '@/lib/theme';

type Props = {
  nameA: string;
  nameB: string;
  vpA: number;
  vpB: number;
};

export function EquitySummary({ nameA, nameB, vpA, vpB }: Props) {
  const gap = contributionGapVp(vpA, vpB);
  const tilt = tiltPercent(vpA, vpB);
  const sum = vpA + vpB;
  const balanced = sum === 0 || gap < 0.01;
  const leader = vpA > vpB ? nameA : vpB > vpA ? nameB : null;
  const behind = vpA < vpB ? nameA : vpB < vpA ? nameB : null;

  if (balanced) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Equity status</Text>
        <Text style={styles.body}>
          You’re in balance this week — contributions feel fair and even.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Equity status</Text>
      <Text style={styles.body}>
        The scale is tipped {tilt}% toward {leader}.{' '}
        <Text style={styles.emph}>
          Contribution gap: {formatVp(gap)} VP
        </Text>
        {behind ? (
          <>
            {'\n'}
            {behind} needs about {formatVp(gap)} VP to reach parity with {leader}.
          </>
        ) : null}
      </Text>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.text,
  },
  emph: {
    fontWeight: '700',
    color: theme.balanceText,
  },
});
