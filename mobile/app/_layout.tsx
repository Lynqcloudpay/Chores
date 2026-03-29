import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#f4faf5' },
            headerTintColor: '#0f172a',
            contentStyle: { backgroundColor: '#f4faf5' },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Equity Engine' }} />
          <Stack.Screen name="login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="register" options={{ title: 'Create account' }} />
          <Stack.Screen name="setup" options={{ title: 'Household setup' }} />
          <Stack.Screen name="history" options={{ title: 'Week history' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
