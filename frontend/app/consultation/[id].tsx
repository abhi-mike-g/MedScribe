import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ChevronLeft, Lock, Pill, FileText, Activity, Cpu, Plus, X } from 'lucide-react-native';

export default function ConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authFetch } = useAuth();
  const router = useRouter();
  const [consultation, setConsultation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRxModal, setShowRxModal] = useState(false);
  const [rxForm, setRxForm] = useState({ diagnosis: '', instructions: '', follow_up_date: '' });
  const [medications, setMedications] = useState<any[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [rxLoading, setRxLoading] = useState(false);

  useEffect(() => { loadConsultation(); }, [id]);

  const loadConsultation = async () => {
    try {
      const res = await authFetch(`/api/consultations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setConsultation(data);
        if (data.extracted_data?.assessment) {
          setRxForm(f => ({ ...f, diagnosis: data.extracted_data.assessment }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const updateMed = (index: number, field: string, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const removeMed = (index: number) => {
    if (medications.length > 1) setMedications(medications.filter((_, i) => i !== index));
  };

  const createPrescription = async () => {
    if (!rxForm.diagnosis || !medications[0].name) return;
    setRxLoading(true);
    try {
      const res = await authFetch('/api/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: consultation.patient_id,
          consultation_id: consultation.id,
          diagnosis: rxForm.diagnosis,
          medications: medications.filter(m => m.name),
          instructions: rxForm.instructions,
          follow_up_date: rxForm.follow_up_date,
        }),
      });
      if (res.ok) {
        const rx = await res.json();
        setShowRxModal(false);
        router.push(`/prescription/${rx.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRxLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!consultation) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Text style={styles.errorText}>Consultation not found</Text></View>
      </SafeAreaView>
    );
  }

  const ed = consultation.extracted_data || {};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-from-detail" onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.e2eeBadge}>
          <Lock size={10} color="#10B981" />
          <Text style={styles.e2eeText}>E2EE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{consultation.patient_name}</Text>
        <Text style={styles.date}>{new Date(consultation.created_at).toLocaleString()}</Text>

        <View style={[styles.statusBadge, consultation.status === 'in_progress' ? styles.statusProgress : styles.statusComplete]}>
          <Activity size={14} color={consultation.status === 'in_progress' ? '#92400E' : '#065F46'} />
          <Text style={[styles.statusText, consultation.status === 'in_progress' ? styles.statusTextProgress : styles.statusTextComplete]}>
            {consultation.status === 'in_progress' ? 'In Progress' : 'Completed'}
          </Text>
        </View>

        {consultation.transcript ? (
          <View style={styles.dataCard}>
            <View style={styles.cardHeader}>
              <Cpu size={14} color={theme.primary} />
              <Text style={styles.dataLabel}>TRANSCRIPT (ON-DEVICE STT)</Text>
            </View>
            <Text style={styles.dataValue}>{consultation.transcript}</Text>
          </View>
        ) : null}

        {ed.assessment ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>ASSESSMENT</Text>
            <Text style={styles.assessmentText}>{ed.assessment}</Text>
          </View>
        ) : null}

        {ed.symptoms?.length ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>SYMPTOMS</Text>
            {ed.symptoms.map((s: string, i: number) => (
              <Text key={i} style={styles.listItem}>• {s}</Text>
            ))}
          </View>
        ) : null}

        {ed.vitals && Object.keys(ed.vitals).length > 0 ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>VITALS</Text>
            {Object.entries(ed.vitals).map(([k, v]) => (
              <View key={k} style={styles.vitalRow}>
                <Text style={styles.vitalKey}>{k.replace(/_/g, ' ').toUpperCase()}</Text>
                <Text style={styles.vitalValue}>{String(v)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {ed.plan?.length ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>PLAN</Text>
            {ed.plan.map((p: string, i: number) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>
            ))}
          </View>
        ) : null}

        {ed.icd_codes?.length ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>ICD CODES</Text>
            {ed.icd_codes.map((c: string, i: number) => (
              <View key={i} style={styles.icdBadge}><Text style={styles.icdText}>{c}</Text></View>
            ))}
          </View>
        ) : null}

        {ed.current_medications?.length ? (
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>CURRENT MEDICATIONS</Text>
            {ed.current_medications.map((m: string, i: number) => (
              <TouchableOpacity key={i} style={styles.medLink} onPress={() => router.push(`/medication/${encodeURIComponent(m.split(' ')[0].toLowerCase())}`)}>
                <Pill size={14} color={theme.primary} />
                <Text style={styles.medLinkText}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <TouchableOpacity testID="generate-prescription-button" style={styles.rxButton} onPress={() => setShowRxModal(true)}>
          <FileText size={18} color="#FFF" />
          <Text style={styles.rxButtonText}>Generate Prescription</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showRxModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Prescription</Text>
              <TouchableOpacity testID="close-rx-modal" onPress={() => setShowRxModal(false)}><X size={22} color={theme.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DIAGNOSIS</Text>
                <TextInput testID="rx-diagnosis-input" style={styles.modalInput} value={rxForm.diagnosis} onChangeText={t => setRxForm(f => ({ ...f, diagnosis: t }))} placeholder="Diagnosis" placeholderTextColor={theme.textSecondary} />
              </View>

              <Text style={styles.medsTitle}>MEDICATIONS</Text>
              {medications.map((med, i) => (
                <View key={i} style={styles.medRow}>
                  <View style={styles.medRowHeader}>
                    <Text style={styles.medRowLabel}>Medication {i + 1}</Text>
                    {medications.length > 1 && (
                      <TouchableOpacity onPress={() => removeMed(i)}><X size={16} color={theme.error} /></TouchableOpacity>
                    )}
                  </View>
                  <TextInput style={styles.modalInput} placeholder="Name" placeholderTextColor={theme.textSecondary} value={med.name} onChangeText={v => updateMed(i, 'name', v)} />
                  <View style={styles.medFields}>
                    <TextInput style={[styles.modalInput, styles.flex1]} placeholder="Dosage" placeholderTextColor={theme.textSecondary} value={med.dosage} onChangeText={v => updateMed(i, 'dosage', v)} />
                    <TextInput style={[styles.modalInput, styles.flex1]} placeholder="Frequency" placeholderTextColor={theme.textSecondary} value={med.frequency} onChangeText={v => updateMed(i, 'frequency', v)} />
                  </View>
                  <TextInput style={styles.modalInput} placeholder="Duration" placeholderTextColor={theme.textSecondary} value={med.duration} onChangeText={v => updateMed(i, 'duration', v)} />
                </View>
              ))}
              <TouchableOpacity testID="add-medication-button" style={styles.addMedButton} onPress={addMedication}>
                <Plus size={16} color={theme.primary} />
                <Text style={styles.addMedText}>Add Medication</Text>
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>INSTRUCTIONS</Text>
                <TextInput testID="rx-instructions-input" style={[styles.modalInput, styles.multiline]} value={rxForm.instructions} onChangeText={t => setRxForm(f => ({ ...f, instructions: t }))} placeholder="Additional instructions" placeholderTextColor={theme.textSecondary} multiline numberOfLines={3} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FOLLOW-UP DATE</Text>
                <TextInput testID="rx-followup-input" style={styles.modalInput} value={rxForm.follow_up_date} onChangeText={t => setRxForm(f => ({ ...f, follow_up_date: t }))} placeholder="e.g. 2 weeks" placeholderTextColor={theme.textSecondary} />
              </View>
            </ScrollView>
            <TouchableOpacity testID="submit-prescription" style={[styles.submitButton, rxLoading && styles.submitDisabled]} onPress={createPrescription} disabled={rxLoading}>
              {rxLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Create Prescription</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: FontSizes.base, color: theme.error },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  date: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, gap: 6, marginBottom: Spacing.lg },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusComplete: { backgroundColor: '#ECFDF5' },
  statusText: { fontSize: FontSizes.sm, fontWeight: '700' },
  statusTextProgress: { color: '#92400E' },
  statusTextComplete: { color: '#065F46' },
  dataCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  dataLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  dataValue: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24 },
  assessmentText: { fontSize: FontSizes.lg, fontWeight: '600', color: theme.textPrimary },
  listItem: { fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: 4, lineHeight: 22 },
  vitalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.border },
  vitalKey: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textSecondary },
  vitalValue: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  icdBadge: { backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 6, marginBottom: Spacing.xs },
  icdText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  medLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  medLinkText: { fontSize: FontSizes.base, color: theme.primary, fontWeight: '500' },
  rxButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, height: 52, borderRadius: 9999, gap: Spacing.sm, marginTop: Spacing.md },
  rxButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  inputGroup: { marginBottom: Spacing.base },
  inputLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  modalInput: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: Spacing.sm },
  multiline: { height: 80, textAlignVertical: 'top', paddingTop: Spacing.md },
  medsTitle: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  medRow: { backgroundColor: theme.inputBg, borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.md },
  medRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  medRowLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textPrimary },
  medFields: { flexDirection: 'row', gap: Spacing.sm },
  flex1: { flex: 1 },
  addMedButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary, borderStyle: 'dashed', borderRadius: 8, height: 44, gap: 6, marginBottom: Spacing.lg },
  addMedText: { fontSize: FontSizes.md, color: theme.primary, fontWeight: '600' },
  submitButton: { backgroundColor: theme.primary, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
});
