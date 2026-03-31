import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Platform, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import {
  ChevronLeft, Lock, Download, FileText, User, Stethoscope, Calendar,
  Clock, Activity, Pill, AlertTriangle, BookOpen, Shield, CheckCircle,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ReportViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { loadReport(); }, [id]);

  const loadReport = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (e) {
      console.error('Failed to load report:', e);
    }
    setLoading(false);
  };

  const downloadPdf = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const url = `${BACKEND_URL}/api/reports/${report.id}/pdf`;
      if (Platform.OS === 'web') {
        // Web: direct download via fetch + blob
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `MedScribe_Report_${report.id}.pdf`;
          a.click();
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        // Native: download and share
        const { StorageAccessFramework } = await import('expo-file-system');
        const FileSystem = await import('expo-file-system');
        const fileUri = FileSystem.documentDirectory + `MedScribe_Report_${report.id}.pdf`;

        const downloadRes = await FileSystem.downloadAsync(
          url,
          fileUri,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (downloadRes.status === 200) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(downloadRes.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Save Medical Report',
            });
          } else {
            Alert.alert('Downloaded', `Report saved to ${fileUri}`);
          }
        } else {
          Alert.alert('Error', 'Failed to download report');
        }
      }
    } catch (e: any) {
      console.error('Download failed:', e);
      Alert.alert('Download Error', e.message || 'Could not download the PDF');
    }
    setDownloading(false);
  };

  if (loading) return (
    <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#0033A0" /></View></SafeAreaView>
  );

  if (!report) return (
    <SafeAreaView style={s.safe}><View style={s.center}><Text style={{ color: theme.error }}>Report not found or access denied</Text></View></SafeAreaView>
  );

  const subj = report.subjective || {};
  const obj = report.objective || {};
  const asmt = report.assessment || {};
  const plan = report.plan || {};

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={20} color={theme.textPrimary} /><Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View style={s.topBadges}>
          <View style={s.e2eeBadge}><Lock size={10} color="#10B981" /><Text style={s.e2eeText}>E2EE</Text></View>
          <View style={[s.statusBadge, report.status === 'sent' ? s.sentBg : s.draftBg]}>
            <Text style={[s.statusBadgeText, report.status === 'sent' ? s.sentColor : s.draftColor]}>{report.status?.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <Text style={s.reportTitle}>MedScribe</Text>
        <Text style={s.reportSubtitle}>AI-Generated Clinical Documentation</Text>
        <Text style={s.reportId}>Report ID: {report.id}</Text>

        {/* Patient / Clinician / Encounter */}
        <View style={s.infoGrid}>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>PATIENT</Text>
            <Text style={s.infoName}>{report.patient_name || 'N/A'}</Text>
            <Text style={s.infoMeta}>{report.patient_gender}, {report.patient_age} years</Text>
            <Text style={s.infoMeta}>ID: {report.patient_id_display || 'N/A'}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>CLINICIAN</Text>
            <Text style={s.infoName}>{report.doctor_name}</Text>
            <Text style={s.infoMeta}>{report.doctor_specialty}</Text>
            <Text style={s.infoMeta}>Reg: {report.doctor_license || 'N/A'}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>ENCOUNTER</Text>
            <Text style={s.infoName}>{report.encounter_date}</Text>
            <Text style={s.infoMeta}>{report.encounter_type}</Text>
            <Text style={s.infoMeta}>Duration: {report.encounter_duration || 'N/A'}</Text>
          </View>
        </View>

        {/* Subjective */}
        <View style={s.soapBar}><FileText size={16} color="#FFF" /><Text style={s.soapTitle}>Subjective (S)</Text></View>
        {subj.chief_complaint ? <View style={s.card}><Text style={s.cardLabel}>CHIEF COMPLAINT</Text><Text style={s.cardText}>{subj.chief_complaint}</Text></View> : null}
        {subj.hpi ? <View style={s.card}><Text style={s.cardLabel}>HISTORY OF PRESENT ILLNESS</Text><Text style={s.cardText}>{subj.hpi}</Text></View> : null}
        {subj.review_of_systems ? <View style={s.card}><Text style={s.cardLabel}>REVIEW OF SYSTEMS</Text><Text style={s.cardText}>{subj.review_of_systems}</Text></View> : null}
        {subj.past_medical_history ? <View style={s.card}><Text style={s.cardLabel}>PAST MEDICAL HISTORY</Text><Text style={s.cardText}>{subj.past_medical_history}</Text></View> : null}
        {subj.current_medications ? <View style={s.card}><Text style={s.cardLabel}>CURRENT MEDICATIONS</Text><Text style={s.cardText}>{subj.current_medications}</Text></View> : null}
        {subj.allergies ? <View style={s.card}><Text style={s.cardLabel}>ALLERGIES</Text><Text style={s.cardText}>{subj.allergies}</Text></View> : null}

        {/* Objective */}
        <View style={s.soapBar}><Activity size={16} color="#FFF" /><Text style={s.soapTitle}>Objective (O)</Text></View>
        {obj.vital_signs?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>VITAL SIGNS</Text>
            <View style={s.vsHeader}>
              <Text style={[s.vsHeaderCell, { flex: 2 }]}>Parameter</Text>
              <Text style={[s.vsHeaderCell, { flex: 1.5 }]}>Value</Text>
              <Text style={[s.vsHeaderCell, { flex: 1.5 }]}>Normal Range</Text>
            </View>
            {obj.vital_signs.map((vs: any, i: number) => (
              <View key={i} style={[s.vsRow, i % 2 === 0 ? s.vsRowAlt : null]}>
                <Text style={[s.vsCell, { flex: 2 }]}>{vs.parameter}</Text>
                <Text style={[s.vsCell, { flex: 1.5, fontWeight: '600' }]}>{vs.value}</Text>
                <Text style={[s.vsCell, { flex: 1.5, color: theme.textSecondary }]}>{vs.normal_range}</Text>
              </View>
            ))}
          </View>
        )}
        {obj.physical_examination ? <View style={s.card}><Text style={s.cardLabel}>PHYSICAL EXAMINATION</Text><Text style={s.cardText}>{obj.physical_examination}</Text></View> : null}
        {obj.lab_results ? <View style={s.card}><Text style={s.cardLabel}>LAB / DIAGNOSTIC RESULTS</Text><Text style={s.cardText}>{obj.lab_results}</Text></View> : null}

        {/* Assessment */}
        <View style={s.soapBar}><Stethoscope size={16} color="#FFF" /><Text style={s.soapTitle}>Assessment (A)</Text></View>
        {asmt.primary_diagnosis ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>PRIMARY DIAGNOSIS</Text>
            <Text style={s.diagnosisText}>{asmt.primary_diagnosis}{asmt.icd_code ? `  (ICD-10: ${asmt.icd_code})` : ''}</Text>
          </View>
        ) : null}
        {asmt.differential_diagnoses?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>DIFFERENTIAL DIAGNOSES</Text>
            {asmt.differential_diagnoses.map((dx: string, i: number) => (
              <Text key={i} style={s.cardText}>{i + 1}. {dx}</Text>
            ))}
          </View>
        )}
        {asmt.clinical_reasoning ? <View style={s.card}><Text style={s.cardLabel}>CLINICAL REASONING</Text><Text style={s.cardText}>{asmt.clinical_reasoning}</Text></View> : null}

        {/* Plan */}
        <View style={s.soapBar}><Pill size={16} color="#FFF" /><Text style={s.soapTitle}>Plan (P)</Text></View>
        {plan.medications?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>MEDICATIONS</Text>
            {plan.medications.map((med: any, i: number) => (
              <View key={i} style={s.medRow}>
                <Text style={s.medName}>{med.drug}</Text>
                <Text style={s.medDetail}>{med.dose} | {med.frequency} | {med.duration}</Text>
                {med.instructions ? <Text style={s.medInstruction}>{med.instructions}</Text> : null}
              </View>
            ))}
          </View>
        )}
        {plan.simple_instructions?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardLabel}>INSTRUCTIONS (SIMPLE LANGUAGE)</Text>
            {plan.simple_instructions.map((inst: string, i: number) => (
              <Text key={i} style={s.cardText}>{i + 1}. {inst}</Text>
            ))}
            {plan.general_advice ? <Text style={[s.cardText, { marginTop: 8, fontWeight: '600' }]}>General advice: {plan.general_advice}</Text> : null}
          </View>
        )}
        {plan.warning_signs?.length > 0 && (
          <View style={[s.card, s.warningCard]}>
            <Text style={[s.cardLabel, { color: '#991B1B' }]}>WHEN TO SEEK IMMEDIATE HELP</Text>
            {plan.warning_signs.map((w: string, i: number) => (
              <View key={i} style={s.warningRow}><AlertTriangle size={12} color="#DC2626" /><Text style={s.warningText}>{w}</Text></View>
            ))}
          </View>
        )}
        {plan.diagnostic_tests ? <View style={s.card}><Text style={s.cardLabel}>DIAGNOSTIC TESTS ORDERED</Text><Text style={s.cardText}>{plan.diagnostic_tests}</Text></View> : null}
        {plan.follow_up ? <View style={s.card}><Text style={s.cardLabel}>FOLLOW-UP</Text><Text style={s.cardText}>{plan.follow_up}</Text></View> : null}

        {/* Patient Education */}
        {report.patient_education ? (
          <>
            <View style={[s.soapBar, { backgroundColor: '#059669' }]}><BookOpen size={16} color="#FFF" /><Text style={s.soapTitle}>Patient Education</Text></View>
            <View style={s.card}><Text style={s.cardText}>{report.patient_education}</Text></View>
          </>
        ) : null}

        {/* Download Button */}
        <TouchableOpacity style={s.downloadBtn} onPress={downloadPdf} disabled={downloading} activeOpacity={0.8}>
          {downloading ? <ActivityIndicator size="small" color="#FFF" /> : <Download size={18} color="#FFF" />}
          <Text style={s.downloadBtnText}>Download PDF Report</Text>
        </TouchableOpacity>

        {/* Doctor: Edit button if draft */}
        {user?.role === 'doctor' && report.status === 'draft' && (
          <TouchableOpacity style={s.editBtn} onPress={() => router.push({ pathname: '/report/generate', params: { sourceType: report.source_type, sourceId: report.source_id } })}>
            <FileText size={16} color="#0033A0" /><Text style={s.editBtnText}>Edit Report</Text>
          </TouchableOpacity>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerLine}>{report.doctor_name}</Text>
          <Text style={s.footerMeta}>{report.doctor_specialty} | Reg: {report.doctor_license || 'N/A'}</Text>
          <View style={s.footerBadges}>
            <View style={s.footerBadge}><Shield size={10} color="#10B981" /><Text style={s.footerBadgeText}>E2E ENCRYPTED</Text></View>
            <View style={s.footerBadge}><Shield size={10} color="#0033A0" /><Text style={s.footerBadgeText}>HIPAA ALIGNED</Text></View>
            <View style={s.footerBadge}><Shield size={10} color={theme.textSecondary} /><Text style={s.footerBadgeText}>PRIVACY BY DESIGN</Text></View>
          </View>
          <Text style={s.footerAi}>Generated by MedScribe v1.0 | AI Clinical Documentation</Text>
          <Text style={s.footerAi}>This document was generated by AI and reviewed by the clinician.</Text>
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
  topBadges: { flexDirection: 'row', gap: 6 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  sentBg: { backgroundColor: '#ECFDF5' },
  draftBg: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  sentColor: { color: '#065F46' },
  draftColor: { color: '#92400E' },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  reportTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: '#0033A0', marginBottom: 2 },
  reportSubtitle: { fontSize: FontSizes.sm, color: theme.textSecondary },
  reportId: { fontSize: FontSizes.sm, color: theme.textSecondary, marginBottom: Spacing.lg },
  infoGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  infoCol: { flex: 1, backgroundColor: '#F4F4F5', borderRadius: 8, padding: Spacing.sm },
  infoLabel: { fontSize: 9, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1, marginBottom: 4 },
  infoName: { fontSize: FontSizes.sm, fontWeight: '700', color: theme.textPrimary },
  infoMeta: { fontSize: FontSizes.xs, color: theme.textSecondary, marginTop: 1 },
  soapBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0033A0', paddingHorizontal: Spacing.base, paddingVertical: 10, borderRadius: 6, gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.sm },
  soapTitle: { fontSize: FontSizes.base, fontWeight: '700', color: '#FFF' },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm },
  cardLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: '#0033A0', letterSpacing: 1, marginBottom: 6 },
  cardText: { fontSize: FontSizes.md, color: theme.textPrimary, lineHeight: 22 },
  diagnosisText: { fontSize: FontSizes.base, fontWeight: '700', color: theme.textPrimary },
  vsHeader: { flexDirection: 'row', backgroundColor: '#0033A0', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 4 },
  vsHeaderCell: { fontSize: FontSizes.xs, fontWeight: '700', color: '#FFF' },
  vsRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8 },
  vsRowAlt: { backgroundColor: '#F9FAFB' },
  vsCell: { fontSize: FontSizes.sm, color: theme.textPrimary },
  medRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  medName: { fontSize: FontSizes.md, fontWeight: '700', color: theme.textPrimary },
  medDetail: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  medInstruction: { fontSize: FontSizes.sm, color: '#0033A0', marginTop: 2, fontStyle: 'italic' },
  warningCard: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  warningText: { fontSize: FontSizes.md, color: '#991B1B' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0033A0', height: 52, borderRadius: 9999, gap: Spacing.sm, marginTop: Spacing.xl },
  downloadBtnText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0033A0', height: 48, borderRadius: 9999, gap: 6, marginTop: Spacing.md },
  editBtnText: { fontSize: FontSizes.base, color: '#0033A0', fontWeight: '600' },
  footer: { alignItems: 'center', paddingTop: Spacing.xl, marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: theme.border },
  footerLine: { fontSize: FontSizes.base, fontWeight: '700', color: theme.textPrimary },
  footerMeta: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  footerBadges: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  footerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  footerBadgeText: { fontSize: 9, fontWeight: '700', color: theme.textSecondary },
  footerAi: { fontSize: FontSizes.xs, color: theme.textSecondary, marginTop: 4, textAlign: 'center' },
});
