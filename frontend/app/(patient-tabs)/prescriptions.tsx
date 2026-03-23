import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { FileText, Download, Pill, Calendar, Lock } from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PatientPrescriptions() {
  const { authFetch, token } = useAuth();
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/api/prescriptions');
      if (r.ok) setPrescriptions(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const downloadPdf = async (rxId: string) => {
    const pdfUrl = `${BACKEND_URL}/api/prescriptions/${rxId}/pdf`;
    if (Platform.OS === 'web') {
      window.open(`${pdfUrl}?token=${token}`, '_blank');
    }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#10B981" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={s.headerRow}>
          <Text style={s.title}>My Prescriptions</Text>
          <View style={s.e2ee}><Lock size={10} color="#10B981" /><Text style={s.e2eeT}>E2EE</Text></View>
        </View>
        <Text style={s.subtitle}>{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''}</Text>

        {prescriptions.length === 0 ? (
          <View style={s.empty}>
            <FileText size={32} color={theme.textSecondary} />
            <Text style={s.emptyTitle}>No prescriptions yet</Text>
            <Text style={s.emptyDesc}>Your doctor's prescriptions will appear here</Text>
          </View>
        ) : (
          prescriptions.map(rx => (
            <View key={rx.id} style={s.card}>
              <TouchableOpacity style={s.cardBody} onPress={() => router.push(`/prescription/${rx.id}`)}>
                <View style={s.rxIcon}><Text style={s.rxIconText}>Rx</Text></View>
                <View style={s.cardInfo}>
                  <Text style={s.rxDiagnosis}>{rx.diagnosis || 'Prescription'}</Text>
                  <Text style={s.rxDoctor}>Dr. {rx.doctor_name}</Text>
                  <View style={s.metaRow}>
                    <Calendar size={12} color={theme.textSecondary} />
                    <Text style={s.metaText}>{new Date(rx.created_at).toLocaleDateString()}</Text>
                    <Pill size={12} color={theme.primary} />
                    <Text style={s.metaText}>{rx.medications?.length || 0} meds</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.downloadBtn} onPress={() => downloadPdf(rx.id)}>
                <Download size={16} color="#0033A0" />
                <Text style={s.downloadText}>PDF</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  e2ee: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeT: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginBottom: Spacing.lg },
  empty: { alignItems: 'center', padding: Spacing.xxxl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12 },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary, marginTop: Spacing.md },
  emptyDesc: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, marginBottom: Spacing.md, overflow: 'hidden' },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md },
  rxIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  rxIconText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#0033A0' },
  cardInfo: { flex: 1 },
  rxDiagnosis: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  rxDoctor: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: FontSizes.xs, color: theme.textSecondary },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E8EEFF', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border },
  downloadText: { fontSize: FontSizes.sm, color: '#0033A0', fontWeight: '700' },
});
