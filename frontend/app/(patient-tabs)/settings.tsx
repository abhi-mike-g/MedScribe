import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { User, Mail, Shield, Lock, LogOut, Phone, Droplet, Calendar } from 'lucide-react-native';

export default function PatientSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Settings</Text>

        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.name?.charAt(0) || 'P'}</Text>
          </View>
          <Text style={s.profileName}>{user?.name}</Text>
          <Text style={s.profileRole}>Patient</Text>
          <View style={s.idBadge}>
            <Text style={s.idText}>{user?.patient_id || 'N/A'}</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>PROFILE DETAILS</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Mail size={16} color={theme.textSecondary} />
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue}>{user?.email}</Text>
          </View>
          {user?.age ? (
            <View style={s.infoRow}>
              <Calendar size={16} color={theme.textSecondary} />
              <Text style={s.infoLabel}>Age</Text>
              <Text style={s.infoValue}>{user.age} years</Text>
            </View>
          ) : null}
          {user?.gender ? (
            <View style={s.infoRow}>
              <User size={16} color={theme.textSecondary} />
              <Text style={s.infoLabel}>Gender</Text>
              <Text style={s.infoValue}>{user.gender}</Text>
            </View>
          ) : null}
          {user?.phone ? (
            <View style={s.infoRow}>
              <Phone size={16} color={theme.textSecondary} />
              <Text style={s.infoLabel}>Phone</Text>
              <Text style={s.infoValue}>{user.phone}</Text>
            </View>
          ) : null}
          {user?.blood_group ? (
            <View style={s.infoRow}>
              <Droplet size={16} color={theme.error} />
              <Text style={s.infoLabel}>Blood Group</Text>
              <Text style={s.infoValue}>{user.blood_group}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.sectionLabel}>SECURITY</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Lock size={16} color="#10B981" />
            <Text style={s.infoLabel}>Encryption</Text>
            <Text style={[s.infoValue, { color: '#10B981' }]}>AES-256-GCM</Text>
          </View>
          <View style={s.infoRow}>
            <Shield size={16} color="#0033A0" />
            <Text style={s.infoLabel}>Compliance</Text>
            <Text style={s.infoValue}>HIPAA & GDPR</Text>
          </View>
        </View>

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
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#10B981' },
  profileName: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  profileRole: { fontSize: FontSizes.md, color: '#10B981', fontWeight: '600', marginTop: 4 },
  idBadge: { backgroundColor: '#052E16', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 9999, marginTop: Spacing.sm },
  idText: { fontSize: FontSizes.sm, color: '#10B981', fontWeight: '700', letterSpacing: 1.5 },
  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  infoCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginBottom: Spacing.lg, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.border },
  infoLabel: { flex: 1, fontSize: FontSizes.md, color: theme.textSecondary },
  infoValue: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.error, height: 52, borderRadius: 9999, gap: Spacing.sm, marginTop: Spacing.md },
  logoutText: { fontSize: FontSizes.base, color: theme.error, fontWeight: '700' },
});
