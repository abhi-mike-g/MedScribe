import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Shield, Users, Stethoscope, User, ClipboardList, FileText, ShieldCheck, Lock } from 'lucide-react-native';

export default function AdminOverview() {
  const { user, authFetch } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await authFetch('/api/admin/stats');
      if (r.ok) setStats(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#7A8BFF" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Admin Dashboard</Text>
            <Text style={s.name}>{user?.name}</Text>
          </View>
          <View style={s.badge}><ShieldCheck size={20} color="#7A8BFF" /></View>
        </View>

        <View style={s.e2ee}>
          <Lock size={12} color="#10B981" />
          <Text style={s.e2eeT}>System Encryption Active — AES-256-GCM</Text>
        </View>

        <Text style={s.sectionTitle}>User Statistics</Text>
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Users size={24} color="#7A8BFF" />
            <Text style={s.statNum}>{stats?.total_users || 0}</Text>
            <Text style={s.statLabel}>TOTAL USERS</Text>
          </View>
          <View style={s.statCard}>
            <Stethoscope size={24} color="#0033A0" />
            <Text style={s.statNum}>{stats?.doctors || 0}</Text>
            <Text style={s.statLabel}>DOCTORS</Text>
          </View>
          <View style={s.statCard}>
            <User size={24} color="#10B981" />
            <Text style={s.statNum}>{stats?.patients || 0}</Text>
            <Text style={s.statLabel}>PATIENTS</Text>
          </View>
          <View style={s.statCard}>
            <ShieldCheck size={24} color="#7A8BFF" />
            <Text style={s.statNum}>{stats?.admins || 0}</Text>
            <Text style={s.statLabel}>ADMINS</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Case Statistics</Text>
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <ClipboardList size={24} color="#F59E0B" />
            <Text style={s.statNum}>{stats?.total_cases || 0}</Text>
            <Text style={s.statLabel}>TOTAL CASES</Text>
          </View>
          <View style={s.statCard}>
            <ClipboardList size={24} color="#F59E0B" />
            <Text style={s.statNum}>{stats?.pending_cases || 0}</Text>
            <Text style={s.statLabel}>PENDING</Text>
          </View>
          <View style={s.statCard}>
            <ClipboardList size={24} color="#10B981" />
            <Text style={s.statNum}>{stats?.responded_cases || 0}</Text>
            <Text style={s.statLabel}>RESPONDED</Text>
          </View>
          <View style={s.statCard}>
            <FileText size={24} color="#0033A0" />
            <Text style={s.statNum}>{stats?.total_prescriptions || 0}</Text>
            <Text style={s.statLabel}>PRESCRIPTIONS</Text>
          </View>
        </View>

        <View style={s.compliance}>
          <Shield size={14} color="#7A8BFF" />
          <Text style={s.complianceT}>HIPAA & GDPR Compliant • Admin Portal</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  greeting: { fontSize: FontSizes.md, color: theme.textSecondary },
  name: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  badge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ECEEFF', alignItems: 'center', justifyContent: 'center' },
  e2ee: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 6, marginBottom: Spacing.lg, gap: 8 },
  e2eeT: { fontSize: FontSizes.sm, color: '#10B981', fontWeight: '600' },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary, marginBottom: Spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  statCard: { width: '47%', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, alignItems: 'center', gap: Spacing.sm },
  statNum: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary },
  statLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5 },
  compliance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg },
  complianceT: { fontSize: FontSizes.sm, color: theme.textSecondary },
});
