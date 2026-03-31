import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LockProvider, useLock } from '../src/context/LockContext';
import { SyncProvider } from '../src/context/SyncContext';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import LockScreen from '../src/components/LockScreen';
import PinSetup from '../src/components/PinSetup';

function AppContent() {
  const { user } = useAuth();
  const { isLocked, hasPinSetup, loading } = useLock();

  const showPinSetup = !!(user && !hasPinSetup && !loading);
  const showLockScreen = !!(user && isLocked && hasPinSetup);

  return (
    <View style={styles.container}>
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

      {/* PIN setup modal - covers screen until user creates a PIN */}
      <Modal visible={showPinSetup} animationType="fade" transparent={false} statusBarTranslucent>
        <PinSetup />
      </Modal>

      {/* Lock screen modal - covers screen when app is locked */}
      <Modal visible={showLockScreen} animationType="fade" transparent={false} statusBarTranslucent>
        <LockScreen />
      </Modal>
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
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate />
    </AuthProvider>
  );
}
