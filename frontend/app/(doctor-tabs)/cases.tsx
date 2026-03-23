import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ClipboardList, Activity, Clock, ChevronRight, User, Lock } from 'lucide-react-native';

export default function DoctorCases() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/api/doctor/pending-cases');
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

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#0033A0" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={s.headerRow}>
          <Text style={s.title}>Cases</Text>
          <View style={s.e2ee}><Lock size={10} color="#10B981" /><Text style={s.e2eeT}>E2EE</Text></View>
        </View>
        <Text style={s.subtitle}>{cases.length} case{cases.length !== 1 ? 's' : ''} in queue</Text>

        {cases.length === 0 ? (
          <View style={s.empty}>
            <ClipboardList size={32} color={theme.textSecondary} />
            <Text style={s.emptyTitle}>No cases</Text>
            <Text style={s.emptyDesc}>Patient submissions will appear here</Text>
          </View>
        ) : (
          cases.map(c => {
            const sc = getStatusColor(c.status);
            return (
              <TouchableOpacity key={c.id} style={s.card} onPress={() => router.push(`/case/${c.id}`)}>
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <View style={s.avatarSmall}>
                      <Text style={s.avatarText}>{c.patient_name?.charAt(0) || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName}>{c.patient_name}</Text>
                      <Text style={s.cardPid}>{c.patient_id} • {c.patient_age}y • {c.patient_gender}</Text>
                    </View>
                  </View>
                  <View style={[s.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.badgeText, { color: sc.text }]}>{c.status}</Text>
                  </View>
                </View>
                {c.chief_complaint ? (
                  <Text style={s.complaint} numberOfLines={2}>{c.chief_complaint}</Text>
                ) : null}
                <View style={s.cardBottom}>
                  <View style={s.metaRow}>
                    <Clock size={12} color={theme.textSecondary} />
                    <Text style={s.metaText}>{new Date(c.created_at).toLocaleString()}</Text>
                  </View>
                  <ChevronRight size={16} color={theme.textSecondary} />
                </View>
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
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSizes.md, fontWeight: '700', color: '#0033A0' },
  cardName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  cardPid: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  complaint: { fontSize: FontSizes.md, color: theme.textPrimary, marginBottom: Spacing.sm, lineHeight: 20 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSizes.sm, color: theme.textSecondary },
});
