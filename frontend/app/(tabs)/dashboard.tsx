import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Shield, Users, FileText, Mic, Lock, Activity, ChevronRight, Cpu } from 'lucide-react-native';

export default function DashboardScreen() {
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const res = await authFetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.doctorName}>Dr. {user?.name?.split(' ').pop()}</Text>
          </View>
          <View style={styles.shieldBadge}>
            <Shield size={20} color={theme.primary} />
          </View>
        </View>

        <View style={styles.e2eeBanner}>
          <Lock size={14} color="#10B981" />
          <Text style={styles.e2eeText}>E2EE Active — {stats?.encryption_status || 'AES-256-GCM'}</Text>
        </View>

        <View style={styles.deviceBanner}>
          <Cpu size={14} color={theme.primary} />
          <Text style={styles.deviceText}>On-Device Models: {stats?.device_models_loaded?.join(', ') || 'Loading...'}</Text>
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity testID="stat-patients" style={styles.statCard} onPress={() => router.push('/(tabs)/patients')}>
            <Users size={22} color={theme.primary} />
            <Text style={styles.statNumber}>{stats?.patient_count || 0}</Text>
            <Text style={styles.statLabel}>PATIENTS</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="stat-consultations" style={styles.statCard} onPress={() => router.push('/(tabs)/consult')}>
            <Mic size={22} color="#7A8BFF" />
            <Text style={styles.statNumber}>{stats?.consultation_count || 0}</Text>
            <Text style={styles.statLabel}>CONSULTS</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="stat-prescriptions" style={styles.statCard} onPress={() => router.push('/(tabs)/prescriptions')}>
            <FileText size={22} color="#10B981" />
            <Text style={styles.statNumber}>{stats?.prescription_count || 0}</Text>
            <Text style={styles.statLabel}>Rx</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity testID="quick-new-consultation" style={styles.actionCard} onPress={() => router.push('/new-consultation')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#E8EEFF' }]}>
                <Mic size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.actionTitle}>New Consultation</Text>
                <Text style={styles.actionDesc}>Start recording with on-device STT</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity testID="quick-add-patient" style={styles.actionCard} onPress={() => router.push('/(tabs)/patients')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#ECFDF5' }]}>
                <Users size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Add Patient</Text>
                <Text style={styles.actionDesc}>Register new patient securely</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Consultations</Text>
          {stats?.recent_consultations?.length ? (
            stats.recent_consultations.map((c: any) => (
              <TouchableOpacity
                testID={`recent-consultation-${c.id}`}
                key={c.id}
                style={styles.recentCard}
                onPress={() => router.push(`/consultation/${c.id}`)}
              >
                <View style={styles.recentLeft}>
                  <Activity size={16} color={c.status === 'in_progress' ? theme.warning : theme.success} />
                  <View>
                    <Text style={styles.recentName}>{c.patient_name}</Text>
                    <Text style={styles.recentDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, c.status === 'in_progress' ? styles.statusProgress : styles.statusComplete]}>
                  <Text style={[styles.statusText, c.status === 'in_progress' ? styles.statusTextProgress : styles.statusTextComplete]}>
                    {c.status === 'in_progress' ? 'In Progress' : 'Complete'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No consultations yet</Text>
              <Text style={styles.emptySubtext}>Start your first consultation above</Text>
            </View>
          )}
        </View>

        <View style={styles.complianceBanner}>
          <Shield size={16} color={theme.primary} />
          <Text style={styles.complianceText}>
            {stats?.compliance?.join(' & ') || 'HIPAA & GDPR'} Compliant — Local-First Architecture
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  greeting: { fontSize: FontSizes.md, color: theme.textSecondary },
  doctorName: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  shieldBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  e2eeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 6, marginBottom: Spacing.sm, gap: 8 },
  e2eeText: { fontSize: FontSizes.sm, color: '#10B981', fontWeight: '600' },
  deviceBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 6, marginBottom: Spacing.lg, gap: 8 },
  deviceText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500', flex: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  statCard: { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, alignItems: 'center', gap: Spacing.sm },
  statNumber: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary },
  statLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5 },
  quickActions: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary, marginBottom: Spacing.md, letterSpacing: -0.3 },
  actionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actionIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  actionDesc: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  recentSection: { marginBottom: Spacing.xl },
  recentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  recentName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  recentDate: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusComplete: { backgroundColor: '#ECFDF5' },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  statusTextProgress: { color: '#92400E' },
  statusTextComplete: { color: '#065F46' },
  emptyCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textSecondary },
  emptySubtext: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 4 },
  complianceBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.md },
  complianceText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontWeight: '500' },
});
