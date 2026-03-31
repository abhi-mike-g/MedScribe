import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LockProvider, useLock } from '../src/context/LockContext';
import { SyncProvider } from '../src/context/SyncContext';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import LockScreen from '../src/components/LockScreen';
import PinSetup from '../src/components/PinSetup';

function AppContent() {
  const { user } = useAuth();
  const { isLocked, hasPinSetup, loading } = useLock();

  // Determine if we need to show a security overlay
  const showPinSetup = user && !hasPinSetup && !loading;
  const showLockScreen = user && isLocked && hasPinSetup;

  return (
    <View style={styles.container}>
      {/* Always render the Stack so navigation state is preserved */}
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
        <Stack.Screen name="report/generate" options={{ presentation: 'modal' }} />
        <Stack.Screen name="report/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="prescription/create" options={{ presentation: 'modal' }} />
      </Stack>

      {/* Security overlays rendered ON TOP of navigation */}
      {showPinSetup && (
        <View style={styles.overlay}>
          <PinSetup />
        </View>
      )}
      {showLockScreen && (
        <View style={styles.overlay}>
          <LockScreen />
        </View>
      )}
    </View>
  );
}

function AuthGate() {
  const { user } = useAuth();
  return (
    <LockProvider isAuthenticated={!!user}>
      <SyncProvider>
        <AppContent />
      </SyncProvider>
    </LockProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate />
    </AuthProvider>
  );
}
