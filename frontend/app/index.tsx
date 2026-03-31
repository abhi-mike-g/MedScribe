import React, { useEffect } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { theme } from '../src/constants/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be fully ready before any routing
    if (!rootNavigationState?.key) return;
    if (loading) return;

    if (user) {
      if (user.role === 'doctor') router.replace('/(doctor-tabs)/dashboard');
      else if (user.role === 'patient') router.replace('/(patient-tabs)/home');
      else if (user.role === 'admin') router.replace('/(admin-tabs)/overview');
      else router.replace('/(auth)/login');
    } else {
      router.replace('/(auth)/login');
    }
  }, [loading, user, rootNavigationState?.key]);

  return (
    <View style={s.c}><ActivityIndicator size="large" color={theme.primary} /></View>
  );
}

const s = StyleSheet.create({ c: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' } });
