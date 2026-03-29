import { View, Text, StyleSheet } from 'react-native';
import { pathToParityLines } from '@/lib/vp';
import { theme } from '@/lib/theme';

type Props = {
  behindName: string | null;
  deficitVp: number;
};

export function PathToParity({ behindName, deficitVp }: Props) {
  if (!behindName || deficitVp <= 0) return null;
  const lines = pathToParityLines(deficitVp);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Path to parity</Text>
      <Text style={styles.sub}>
        Ideas for {behindName} — pick what fits your week. (Chores are examples; adjust to your home.)
      </Text>
      {lines.map((line) => (
        <View key={line} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        Providing still counts too — cash contributions convert at 1.5 VP per $1 (including takeout for both).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.tipBSoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: theme.muted,
    marginBottom: 10,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 16,
    color: theme.tipB,
    marginTop: 1,
  },
  line: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: theme.text,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    color: theme.muted,
    lineHeight: 18,
  },
});
