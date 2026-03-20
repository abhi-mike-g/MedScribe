import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { FileText, Lock, Clock, ChevronRight, Pill } from 'lucide-react-native';

export default function PrescriptionsScreen() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPrescriptions = async () => {
    try {
      const res = await authFetch('/api/prescriptions');
      if (res.ok) setPrescriptions(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadPrescriptions(); }, []));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Prescriptions</Text>
        <Text style={styles.subtitle}>JSON & PDF exports available</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPrescriptions(); }} tintColor={theme.primary} />}
        >
          {prescriptions.length === 0 ? (
            <View style={styles.emptyCard}>
              <FileText size={36} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No prescriptions yet</Text>
              <Text style={styles.emptySubtext}>Prescriptions are generated from consultations</Text>
            </View>
          ) : (
            prescriptions.map(p => (
              <TouchableOpacity
                testID={`prescription-card-${p.id}`}
                key={p.id}
                style={styles.card}
                onPress={() => router.push(`/prescription/${p.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.rxBadge}>
                    <Text style={styles.rxText}>Rx</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardPatient}>{p.patient_name}</Text>
                    <Text style={styles.cardDiagnosis} numberOfLines={1}>{p.diagnosis}</Text>
                  </View>
                  <ChevronRight size={18} color={theme.textSecondary} />
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.medCount}>
                    <Pill size={12} color={theme.primary} />
                    <Text style={styles.medCountText}>{p.medications?.length || 0} medications</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Clock size={12} color={theme.textSecondary} />
                    <Text style={styles.cardDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
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
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  rxBadge: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  rxText: { fontSize: FontSizes.md, fontWeight: '800', color: theme.primary },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  cardPatient: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  cardDiagnosis: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: theme.border },
  medCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  medCountText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDate: { fontSize: FontSizes.sm, color: theme.textSecondary },
  emptyCard: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginTop: Spacing.xl },
  emptyText: { fontSize: FontSizes.lg, fontWeight: '600', color: theme.textSecondary, marginTop: Spacing.md },
  emptySubtext: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: 4, textAlign: 'center' },
});
