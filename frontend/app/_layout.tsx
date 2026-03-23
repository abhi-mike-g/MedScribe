import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(doctor-tabs)" />
        <Stack.Screen name="(patient-tabs)" />
        <Stack.Screen name="(admin-tabs)" />
        <Stack.Screen name="case/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="doctor-respond/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="prescription/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="medication/[name]" options={{ presentation: 'modal' }} />
      </Stack>
    </AuthProvider>
  );
}
