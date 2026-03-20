import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Mic, Activity, Lock, Clock, ChevronRight, Plus } from 'lucide-react-native';

export default function ConsultScreen() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConsultations = async () => {
    try {
      const res = await authFetch('/api/consultations');
      if (res.ok) setConsultations(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadConsultations(); }, []));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Consultations</Text>
          <Text style={styles.subtitle}>On-device STT powered sessions</Text>
        </View>
        <TouchableOpacity testID="new-consultation-button" style={styles.addButton} onPress={() => router.push('/new-consultation')}>
          <Plus size={18} color="#FFF" />
          <Text style={styles.addText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConsultations(); }} tintColor={theme.primary} />}
        >
          {consultations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Mic size={36} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No consultations yet</Text>
              <Text style={styles.emptySubtext}>Start a new consultation to record and transcribe</Text>
              <TouchableOpacity testID="empty-new-consultation" style={styles.emptyButton} onPress={() => router.push('/new-consultation')}>
                <Text style={styles.emptyButtonText}>Start First Consultation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            consultations.map(c => (
              <TouchableOpacity
                testID={`consultation-card-${c.id}`}
                key={c.id}
                style={styles.card}
                onPress={() => router.push(`/consultation/${c.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <Activity size={18} color={c.status === 'in_progress' ? theme.warning : theme.success} />
                    <View>
                      <Text style={styles.cardPatient}>{c.patient_name}</Text>
                      <Text style={styles.cardComplaint} numberOfLines={1}>{c.chief_complaint || 'No complaint recorded'}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={theme.textSecondary} />
                </View>
                <View style={styles.cardFooter}>
                  <View style={styles.cardMeta}>
                    <Clock size={12} color={theme.textSecondary} />
                    <Text style={styles.cardDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.cardBadges}>
                    <View style={[styles.badge, c.status === 'in_progress' ? styles.badgeProgress : styles.badgeComplete]}>
                      <Text style={[styles.badgeText, c.status === 'in_progress' ? styles.badgeTextProgress : styles.badgeTextComplete]}>
                        {c.status === 'in_progress' ? 'In Progress' : 'Complete'}
                      </Text>
                    </View>
                    <Lock size={12} color="#10B981" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: 9999, gap: 6 },
  addText: { color: '#FFF', fontSize: FontSizes.md, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  cardPatient: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  cardComplaint: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: theme.border },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: FontSizes.sm, color: theme.textSecondary },
  cardBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  badgeProgress: { backgroundColor: '#FEF3C7' },
  badgeComplete: { backgroundColor: '#ECFDF5' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  badgeTextProgress: { color: '#92400E' },
  badgeTextComplete: { color: '#065F46' },
  emptyCard: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginTop: Spacing.xl },
  emptyText: { fontSize: FontSizes.lg, fontWeight: '600', color: theme.textSecondary, marginTop: Spacing.md },
  emptySubtext: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: 4, textAlign: 'center' },
  emptyButton: { backgroundColor: theme.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 9999, marginTop: Spacing.lg },
  emptyButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
});
