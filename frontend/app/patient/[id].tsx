import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ChevronLeft, Lock, Activity, Calendar, Phone, Mail, Droplet, AlertTriangle, FileText } from 'lucide-react-native';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authFetch } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        authFetch(`/api/patients/${id}`),
        authFetch(`/api/consultations?patient_id=${id}`),
      ]);
      if (pRes.ok) setPatient(await pRes.json());
      if (cRes.ok) setConsultations(await cRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  if (!patient) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={{ color: theme.error }}>Patient not found</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-patient-detail" onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color={theme.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.e2eeBadge}>
          <Lock size={10} color="#10B981" />
          <Text style={styles.e2eeText}>E2EE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{patient.name.charAt(0)}</Text></View>
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.meta}>{patient.age} years • {patient.gender}</Text>
        </View>

        <View style={styles.infoGrid}>
          {patient.phone ? (
            <View style={styles.infoItem}>
              <Phone size={16} color={theme.textSecondary} />
              <Text style={styles.infoText}>{patient.phone}</Text>
            </View>
          ) : null}
          {patient.email ? (
            <View style={styles.infoItem}>
              <Mail size={16} color={theme.textSecondary} />
              <Text style={styles.infoText}>{patient.email}</Text>
            </View>
          ) : null}
          {patient.blood_group ? (
            <View style={styles.infoItem}>
              <Droplet size={16} color={theme.error} />
              <Text style={styles.infoText}>Blood: {patient.blood_group}</Text>
            </View>
          ) : null}
          <View style={styles.infoItem}>
            <Calendar size={16} color={theme.textSecondary} />
            <Text style={styles.infoText}>Since {new Date(patient.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        {patient.allergies?.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AlertTriangle size={16} color={theme.error} />
              <Text style={styles.cardLabel}>ALLERGIES</Text>
            </View>
            <View style={styles.tagRow}>
              {patient.allergies.map((a: string, i: number) => (
                <View key={i} style={styles.allergyTag}><Text style={styles.allergyText}>{a}</Text></View>
              ))}
            </View>
          </View>
        )}

        {patient.medical_history?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>MEDICAL HISTORY</Text>
            {patient.medical_history.map((h: string, i: number) => (
              <Text key={i} style={styles.historyItem}>• {h}</Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Consultation History</Text>
        {consultations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No consultations for this patient</Text>
          </View>
        ) : (
          consultations.map(c => (
            <TouchableOpacity key={c.id} style={styles.consultCard} onPress={() => router.push(`/consultation/${c.id}`)}>
              <View style={styles.consultLeft}>
                <Activity size={16} color={c.status === 'in_progress' ? theme.warning : theme.success} />
                <View>
                  <Text style={styles.consultComplaint}>{c.chief_complaint || 'Consultation'}</Text>
                  <Text style={styles.consultDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <FileText size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  profileHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.primary },
  name: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary },
  meta: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: 4 },
  infoGrid: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  infoText: { fontSize: FontSizes.md, color: theme.textPrimary },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  cardLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  allergyTag: { backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  allergyText: { fontSize: FontSizes.sm, color: theme.error, fontWeight: '600' },
  historyItem: { fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: 4 },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.md },
  consultCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm },
  consultLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  consultComplaint: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  consultDate: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  emptyCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSizes.md, color: theme.textSecondary },
});
