import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ChevronLeft, Lock, Activity, Clock, User, FileText, MessageSquare } from 'lucide-react-native';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCase(); }, [id]);

  const loadCase = async () => {
    try {
      const r = await authFetch(`/api/cases/${id}`);
      if (r.ok) setCaseData(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#FEF3C7', text: '#92400E' };
      case 'responded': return { bg: '#ECFDF5', text: '#065F46' };
      case 'assigned': return { bg: '#E8EEFF', text: '#0033A0' };
      default: return { bg: theme.border, text: theme.textSecondary };
    }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  if (!caseData) return <SafeAreaView style={s.safe}><View style={s.center}><Text style={{ color: theme.error }}>Case not found</Text></View></SafeAreaView>;

  const sc = getStatusStyle(caseData.status);
  const isDoctor = user?.role === 'doctor';
  const dr = caseData.doctor_response;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={20} color={theme.textPrimary} /><Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View style={s.e2ee}><Lock size={10} color="#10B981" /><Text style={s.e2eeT}>E2EE</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatarSmall}><Text style={s.avatarText}>{caseData.patient_name?.charAt(0)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.patientName}>{caseData.patient_name}</Text>
            <Text style={s.patientMeta}>{caseData.patient_id} \u2022 {caseData.patient_age}y \u2022 {caseData.patient_gender}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[s.statusText, { color: sc.text }]}>{caseData.status}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          <Clock size={14} color={theme.textSecondary} />
          <Text style={s.metaText}>Submitted: {new Date(caseData.created_at).toLocaleString()}</Text>
        </View>

        {/* Chief Complaint */}
        {caseData.chief_complaint ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>CHIEF COMPLAINT</Text>
            <Text style={s.cardValue}>{caseData.chief_complaint}</Text>
          </View>
        ) : null}

        {/* Transcript */}
        <View style={s.card}>
          <Text style={s.cardLabel}>PATIENT TRANSCRIPT</Text>
          <Text style={s.transcriptText}>{caseData.transcript}</Text>
        </View>

        {/* Doctor Response */}
        {dr && (
          <View style={[s.card, s.responseCard]}>
            <View style={s.responseHeader}>
              <MessageSquare size={16} color="#0033A0" />
              <Text style={s.responseTitle}>Doctor's Response</Text>
            </View>
            <Text style={s.responseType}>{dr.response_type?.toUpperCase()}</Text>
            <Text style={s.responseMessage}>{dr.message}</Text>
            {dr.diagnosis ? (
              <View style={s.responseField}>
                <Text style={s.responseFieldLabel}>Diagnosis:</Text>
                <Text style={s.responseFieldValue}>{dr.diagnosis}</Text>
              </View>
            ) : null}
            {dr.instructions ? (
              <View style={s.responseField}>
                <Text style={s.responseFieldLabel}>Instructions:</Text>
                <Text style={s.responseFieldValue}>{dr.instructions}</Text>
              </View>
            ) : null}
            {dr.medications?.length > 0 ? (
              <View style={s.responseField}>
                <Text style={s.responseFieldLabel}>Medications:</Text>
                {dr.medications.map((m: any, i: number) => (
                  <Text key={i} style={s.medItem}>\u2022 {m.name} {m.dosage} - {m.frequency} ({m.duration})</Text>
                ))}
              </View>
            ) : null}
            {dr.follow_up_date ? (
              <View style={s.responseField}>
                <Text style={s.responseFieldLabel}>Follow-up:</Text>
                <Text style={s.responseFieldValue}>{dr.follow_up_date}</Text>
              </View>
            ) : null}
            <Text style={s.respondedAt}>Responded: {new Date(dr.responded_at).toLocaleString()}</Text>
          </View>
        )}

        {/* Doctor Action: Respond to Case */}
        {isDoctor && caseData.status === 'pending' && (
          <TouchableOpacity style={s.respondBtn} onPress={() => router.push(`/doctor-respond/${caseData.id}`)}>
            <MessageSquare size={18} color="#FFF" />
            <Text style={s.respondBtnText}>Respond to Case</Text>
          </TouchableOpacity>
        )}

        {/* View Prescription */}
        {caseData.prescription_id && (
          <TouchableOpacity style={s.rxBtn} onPress={() => router.push(`/prescription/${caseData.prescription_id}`)}>
            <FileText size={18} color="#0033A0" />
            <Text style={s.rxBtnText}>View Prescription</Text>
          </TouchableOpacity>
        )}

        {/* Doctor Action: Generate Medical Report */}
        {isDoctor && (
          <TouchableOpacity style={s.reportBtn} onPress={() => router.push({
            pathname: '/report/generate',
            params: { sourceType: 'case', sourceId: caseData.id },
          })}>
            <FileText size={18} color="#0033A0" />
            <Text style={s.rxBtnText}>Generate Medical Report</Text>
          </TouchableOpacity>
        )}

        <View style={s.encryption}>
          <Lock size={12} color="#10B981" />
          <Text style={s.encryptionText}>End-to-End Encrypted \u2022 {caseData.encryption_status}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  e2ee: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeT: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatarSmall: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSizes.xl, fontWeight: '700', color: '#0033A0' },
  patientName: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  patientMeta: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg },
  metaText: { fontSize: FontSizes.sm, color: theme.textSecondary },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.md },
  cardLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  cardValue: { fontSize: FontSizes.lg, fontWeight: '600', color: theme.textPrimary },
  transcriptText: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24 },
  responseCard: { borderColor: '#0033A0', backgroundColor: '#F8F9FF' },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  responseTitle: { fontSize: FontSizes.base, fontWeight: '700', color: '#0033A0' },
  responseType: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.primary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  responseMessage: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 22, marginBottom: Spacing.md },
  responseField: { marginBottom: Spacing.sm },
  responseFieldLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 },
  responseFieldValue: { fontSize: FontSizes.base, color: theme.textPrimary },
  medItem: { fontSize: FontSizes.sm, color: theme.textPrimary, marginLeft: Spacing.sm, lineHeight: 22 },
  respondedAt: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: Spacing.sm },
  respondBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0033A0', height: 52, borderRadius: 9999, gap: Spacing.sm, marginBottom: Spacing.md },
  respondBtnText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  rxBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#0033A0', height: 48, borderRadius: 9999, gap: Spacing.sm, marginBottom: Spacing.md },
  rxBtnText: { fontSize: FontSizes.base, color: '#0033A0', fontWeight: '600' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#0033A0', backgroundColor: '#E8EEFF', height: 48, borderRadius: 9999, gap: Spacing.sm, marginBottom: Spacing.md },
  encryption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg },
  encryptionText: { fontSize: FontSizes.sm, color: theme.textSecondary },
});
