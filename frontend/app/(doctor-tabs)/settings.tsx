import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useLock } from '../../src/context/LockContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Stethoscope, Mail, Shield, Lock, LogOut, Briefcase, Award } from 'lucide-react-native';
import SecuritySyncSettings from '../../src/components/SecuritySyncSettings';

export default function DoctorSettings() {
  const { user, logout } = useAuth();
  const { resetLockState } = useLock();
  const router = useRouter();

  const handleLogout = async () => {
    await resetLockState();
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Settings</Text>

        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
          </View>
          <Text style={s.profileName}>Dr. {user?.name}</Text>
          <Text style={s.profileRole}>Doctor</Text>
        </View>

        <Text style={s.sectionLabel}>PROFILE DETAILS</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Mail size={16} color={theme.textSecondary} />
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue}>{user?.email}</Text>
          </View>
          {user?.specialty ? (
            <View style={s.infoRow}>
              <Briefcase size={16} color={theme.textSecondary} />
              <Text style={s.infoLabel}>Specialty</Text>
              <Text style={s.infoValue}>{user.specialty}</Text>
            </View>
          ) : null}
          {user?.license_number ? (
            <View style={s.infoRow}>
              <Award size={16} color={theme.textSecondary} />
              <Text style={s.infoLabel}>License</Text>
              <Text style={s.infoValue}>{user.license_number}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.sectionLabel}>SECURITY & SYNC</Text>
        <SecuritySyncSettings />

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={theme.error} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: Spacing.lg },
  profileCard: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: Spacing.xl, marginBottom: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#0033A0' },
  profileName: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  profileRole: { fontSize: FontSizes.md, color: '#0033A0', fontWeight: '600', marginTop: 4 },
  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  infoCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginBottom: Spacing.lg, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.border },
  infoLabel: { flex: 1, fontSize: FontSizes.md, color: theme.textSecondary },
  infoValue: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.error, height: 52, borderRadius: 9999, gap: Spacing.sm, marginTop: Spacing.md },
  logoutText: { fontSize: FontSizes.base, color: theme.error, fontWeight: '700' },
});
