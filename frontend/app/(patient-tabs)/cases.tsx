import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ClipboardList, Activity, Clock, ChevronRight, Lock } from 'lucide-react-native';

export default function PatientCases() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/api/cases/my');
      if (r.ok) setCases(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#FEF3C7', text: '#92400E' };
      case 'responded': return { bg: '#ECFDF5', text: '#065F46' };
      case 'assigned': return { bg: '#E8EEFF', text: '#0033A0' };
      default: return { bg: theme.border, text: theme.textSecondary };
    }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#10B981" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={s.headerRow}>
          <Text style={s.title}>My Cases</Text>
          <View style={s.e2ee}><Lock size={10} color="#10B981" /><Text style={s.e2eeT}>E2EE</Text></View>
        </View>
        <Text style={s.subtitle}>{cases.length} case{cases.length !== 1 ? 's' : ''} submitted</Text>

        {cases.length === 0 ? (
          <View style={s.empty}>
            <ClipboardList size={32} color={theme.textSecondary} />
            <Text style={s.emptyTitle}>No cases yet</Text>
            <Text style={s.emptyDesc}>Record and submit a case to see it here</Text>
          </View>
        ) : (
          cases.map(c => {
            const sc = getStatusColor(c.status);
            return (
              <TouchableOpacity key={c.id} style={s.card} onPress={() => router.push(`/case/${c.id}`)}>
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <Activity size={16} color={sc.text} />
                    <Text style={s.cardTitle} numberOfLines={1}>{c.chief_complaint || 'Case Submission'}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.badgeText, { color: sc.text }]}>{c.status}</Text>
                  </View>
                </View>
                <View style={s.cardBottom}>
                  <View style={s.metaRow}>
                    <Clock size={12} color={theme.textSecondary} />
                    <Text style={s.metaText}>{new Date(c.created_at).toLocaleString()}</Text>
                  </View>
                  <ChevronRight size={16} color={theme.textSecondary} />
                </View>
                {c.status === 'responded' && c.doctor_response && (
                  <View style={s.responsePreview}>
                    <Text style={s.responseLabel}>Doctor's Response:</Text>
                    <Text style={s.responseText} numberOfLines={2}>{c.doctor_response.message}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
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
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, marginRight: Spacing.sm },
  cardTitle: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSizes.sm, color: theme.textSecondary },
  responsePreview: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border },
  responseLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: '#10B981', letterSpacing: 1, marginBottom: 4 },
  responseText: { fontSize: FontSizes.sm, color: theme.textPrimary, lineHeight: 20 },
});
