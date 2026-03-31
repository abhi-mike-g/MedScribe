import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LockProvider, useLock } from '../src/context/LockContext';
import { SyncProvider } from '../src/context/SyncContext';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import LockScreen from '../src/components/LockScreen';
import PinSetup from '../src/components/PinSetup';

import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LockProvider, useLock } from '../src/context/LockContext';
import { SyncProvider } from '../src/context/SyncContext';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import LockScreen from '../src/components/LockScreen';
import PinSetup from '../src/components/PinSetup';

// ErrorBoundary catches StackRouter rehydration errors on web and auto-recovers
class NavErrorBoundary extends React.Component<
  { children: React.ReactNode }, { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {
    // Auto-recover after brief delay
    setTimeout(() => this.setState({ hasError: false }), 300);
  }
  render() {
    if (this.state.hasError) {
      return <View style={{ flex: 1, backgroundColor: '#F8FAFC' }} />;
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user } = useAuth();
  const { isLocked, hasPinSetup, loading } = useLock();

  const showPinSetup = !!(user && !hasPinSetup && !loading);
  const showLockScreen = !!(user && isLocked && hasPinSetup);

  return (
    <View style={styles.container}>
      <NavErrorBoundary>
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
      </NavErrorBoundary>

      {/* Use RN Modal for security screens */}
      <Modal visible={showPinSetup} animationType="fade" transparent={false} statusBarTranslucent>
        <PinSetup />
      </Modal>

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
