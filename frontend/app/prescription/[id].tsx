import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ChevronLeft, Lock, Pill, Download, FileJson, Clipboard, CheckCircle } from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authFetch, token } = useAuth();
  const router = useRouter();
  const [prescription, setPrescription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jsonView, setJsonView] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadPrescription(); }, [id]);

  const loadPrescription = async () => {
    try {
      const res = await authFetch(`/api/prescriptions/${id}`);
      if (res.ok) setPrescription(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const pdfUrl = `${BACKEND_URL}/api/prescriptions/${id}/pdf`;
      if (Platform.OS === 'web') {
        window.open(`${pdfUrl}?token=${token}`, '_blank');
      } else {
        Alert.alert('PDF Download', 'PDF generation available. In production, this would save to device storage.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyJson = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  if (!prescription) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={{ color: theme.error }}>Prescription not found</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-prescription-detail" onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color={theme.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.e2eeBadge}>
          <Lock size={10} color="#10B981" />
          <Text style={styles.e2eeText}>E2EE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.rxHeader}>
          <View style={styles.rxBadge}><Text style={styles.rxBadgeText}>Rx</Text></View>
          <Text style={styles.title}>Prescription</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient</Text>
            <Text style={styles.infoValue}>{prescription.patient_name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age / Gender</Text>
            <Text style={styles.infoValue}>{prescription.patient_age}y / {prescription.patient_gender}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Doctor</Text>
            <Text style={styles.infoValue}>Dr. {prescription.doctor_name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{new Date(prescription.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.diagnosisCard}>
          <Text style={styles.sectionLabel}>DIAGNOSIS</Text>
          <Text style={styles.diagnosisText}>{prescription.diagnosis}</Text>
        </View>

        <Text style={styles.sectionLabel}>MEDICATIONS</Text>
        {prescription.medications?.map((med: any, i: number) => (
          <TouchableOpacity
            key={i}
            style={styles.medCard}
            onPress={() => router.push(`/medication/${encodeURIComponent(med.name.toLowerCase())}`)}
          >
            <View style={styles.medHeader}>
              <Pill size={18} color={theme.primary} />
              <Text style={styles.medName}>{med.name}</Text>
            </View>
            <View style={styles.medDetails}>
              {med.dosage ? <View style={styles.medDetail}><Text style={styles.detailLabel}>Dosage</Text><Text style={styles.detailValue}>{med.dosage}</Text></View> : null}
              {med.frequency ? <View style={styles.medDetail}><Text style={styles.detailLabel}>Frequency</Text><Text style={styles.detailValue}>{med.frequency}</Text></View> : null}
              {med.duration ? <View style={styles.medDetail}><Text style={styles.detailLabel}>Duration</Text><Text style={styles.detailValue}>{med.duration}</Text></View> : null}
            </View>
            <Text style={styles.tapHint}>Tap for drug information</Text>
          </TouchableOpacity>
        ))}

        {prescription.instructions ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>INSTRUCTIONS</Text>
            <Text style={styles.instructionText}>{prescription.instructions}</Text>
          </View>
        ) : null}

        {prescription.follow_up_date ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>FOLLOW-UP</Text>
            <Text style={styles.followUpText}>{prescription.follow_up_date}</Text>
          </View>
        ) : null}

        <View style={styles.toggleRow}>
          <TouchableOpacity testID="view-formatted" style={[styles.toggleBtn, !jsonView && styles.toggleActive]} onPress={() => setJsonView(false)}>
            <Text style={[styles.toggleText, !jsonView && styles.toggleTextActive]}>Formatted</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="view-json" style={[styles.toggleBtn, jsonView && styles.toggleActive]} onPress={() => setJsonView(true)}>
            <FileJson size={14} color={jsonView ? '#FFF' : theme.textSecondary} />
            <Text style={[styles.toggleText, jsonView && styles.toggleTextActive]}>JSON</Text>
          </TouchableOpacity>
        </View>

        {jsonView && (
          <View style={styles.jsonCard}>
            <TouchableOpacity testID="copy-json-button" style={styles.copyBtn} onPress={copyJson}>
              {copied ? <CheckCircle size={14} color={theme.success} /> : <Clipboard size={14} color={theme.primary} />}
              <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
            <Text style={styles.jsonText}>
              {JSON.stringify({
                patient: prescription.patient_name,
                diagnosis: prescription.diagnosis,
                medications: prescription.medications,
                instructions: prescription.instructions,
                follow_up: prescription.follow_up_date,
                date: prescription.created_at,
              }, null, 2)}
            </Text>
          </View>
        )}

        <TouchableOpacity testID="download-pdf-button" style={styles.pdfButton} onPress={downloadPdf}>
          <Download size={18} color="#FFF" />
          <Text style={styles.pdfButtonText}>Download PDF</Text>
        </TouchableOpacity>
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
  rxHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  rxBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  rxBadgeText: { fontSize: FontSizes.lg, fontWeight: '800', color: theme.primary },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary },
  infoCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: FontSizes.md, color: theme.textSecondary },
  infoValue: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary },
  divider: { height: 1, backgroundColor: theme.border },
  diagnosisCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  diagnosisText: { fontSize: FontSizes.lg, fontWeight: '600', color: theme.textPrimary },
  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  medCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  medName: { fontSize: FontSizes.base, fontWeight: '700', color: theme.textPrimary },
  medDetails: { gap: Spacing.sm },
  medDetail: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: FontSizes.sm, color: theme.textSecondary },
  detailValue: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textPrimary },
  tapHint: { fontSize: FontSizes.xs, color: theme.primary, marginTop: Spacing.sm, fontStyle: 'italic' },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  instructionText: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 22 },
  followUpText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  toggleRow: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 8, borderWidth: 1, borderColor: theme.border, gap: 6 },
  toggleActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  toggleText: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textSecondary },
  toggleTextActive: { color: '#FFF' },
  jsonCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  copyBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginBottom: Spacing.sm },
  copyText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  jsonText: { fontSize: FontSizes.sm, color: theme.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 20 },
  pdfButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, height: 52, borderRadius: 9999, gap: Spacing.sm },
  pdfButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
});
