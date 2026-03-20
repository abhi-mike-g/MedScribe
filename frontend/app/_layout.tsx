import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="consultation/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="patient/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="prescription/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="medication/[name]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="new-consultation" options={{ presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );
}
