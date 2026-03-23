import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ChevronLeft, Send, Plus, X, Lock, CheckCircle } from 'lucide-react-native';

type ResponseType = 'remedy' | 'prescription' | 'visit';

export default function DoctorRespondScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authFetch } = useAuth();
  const router = useRouter();

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [responseType, setResponseType] = useState<ResponseType>('remedy');
  const [message, setMessage] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [medications, setMedications] = useState([{ name: '', dosage: '', frequency: '', duration: '' }]);

  useEffect(() => { loadCase(); }, [id]);

  const loadCase = async () => {
    try {
      const r = await authFetch(`/api/cases/${id}`);
      if (r.ok) setCaseData(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addMed = () => setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  const updateMed = (i: number, field: string, val: string) => {
    const updated = [...medications]; updated[i] = { ...updated[i], [field]: val }; setMedications(updated);
  };
  const removeMed = (i: number) => { if (medications.length > 1) setMedications(medications.filter((_, idx) => idx !== i)); };

  const submit = async () => {
    if (!message.trim()) { setError('Response message is required'); return; }
    setSubmitting(true); setError('');
    try {
      const body: any = {
        response_type: responseType,
        message,
        diagnosis,
        instructions,
        follow_up_date: followUpDate,
        visit_date: visitDate,
        medications: responseType === 'prescription' ? medications.filter(m => m.name.trim()) : [],
      };
      const r = await authFetch(`/api/cases/${id}/respond`, { method: 'PUT', body: JSON.stringify(body) });
      if (r.ok) { setDone(true); }
      else { const e = await r.json(); setError(e.detail || 'Failed to submit response'); }
    } catch (e) { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.center, { padding: Spacing.xl }]}>
          <CheckCircle size={48} color="#10B981" />
          <Text style={s.doneTitle}>Response Submitted!</Text>
          <Text style={s.doneDesc}>Your response has been encrypted and sent to the patient.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Back to Cases</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const TYPES: { key: ResponseType; label: string }[] = [
    { key: 'remedy', label: 'Remedy' },
    { key: 'prescription', label: 'Prescription' },
    { key: 'visit', label: 'Schedule Visit' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft size={20} color={theme.textPrimary} /><Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <View style={s.e2ee}><Lock size={10} color="#10B981" /><Text style={s.e2eeT}>E2EE</Text></View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Respond to Case</Text>

          {caseData && (
            <View style={s.patientBanner}>
              <Text style={s.bannerName}>{caseData.patient_name}</Text>
              <Text style={s.bannerMeta}>{caseData.patient_id} \u2022 {caseData.patient_age}y \u2022 {caseData.patient_gender}</Text>
              {caseData.chief_complaint ? <Text style={s.bannerComplaint}>"{caseData.chief_complaint}"</Text> : null}
            </View>
          )}

          {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}

          <Text style={s.fieldLabel}>RESPONSE TYPE</Text>
          <View style={s.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[s.typeBtn, responseType === t.key && s.typeActive]} onPress={() => setResponseType(t.key)}>
                <Text style={[s.typeText, responseType === t.key && s.typeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>MESSAGE TO PATIENT *</Text>
          <TextInput style={[s.input, s.multiline]} value={message} onChangeText={setMessage} placeholder="Your response to the patient..." placeholderTextColor={theme.textSecondary} multiline textAlignVertical="top" />

          <Text style={s.fieldLabel}>DIAGNOSIS</Text>
          <TextInput style={s.input} value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" placeholderTextColor={theme.textSecondary} />

          {responseType === 'prescription' && (
            <>
              <Text style={s.fieldLabel}>MEDICATIONS</Text>
              {medications.map((med, i) => (
                <View key={i} style={s.medRow}>
                  <View style={s.medRowHeader}>
                    <Text style={s.medRowLabel}>Medication {i + 1}</Text>
                    {medications.length > 1 && <TouchableOpacity onPress={() => removeMed(i)}><X size={16} color={theme.error} /></TouchableOpacity>}
                  </View>
                  <TextInput style={s.medInput} placeholder="Name" placeholderTextColor={theme.textSecondary} value={med.name} onChangeText={v => updateMed(i, 'name', v)} />
                  <View style={s.medFields}>
                    <TextInput style={[s.medInput, { flex: 1 }]} placeholder="Dosage" placeholderTextColor={theme.textSecondary} value={med.dosage} onChangeText={v => updateMed(i, 'dosage', v)} />
                    <TextInput style={[s.medInput, { flex: 1 }]} placeholder="Frequency" placeholderTextColor={theme.textSecondary} value={med.frequency} onChangeText={v => updateMed(i, 'frequency', v)} />
                  </View>
                  <TextInput style={s.medInput} placeholder="Duration" placeholderTextColor={theme.textSecondary} value={med.duration} onChangeText={v => updateMed(i, 'duration', v)} />
                </View>
              ))}
              <TouchableOpacity style={s.addMedBtn} onPress={addMed}>
                <Plus size={16} color={theme.primary} /><Text style={s.addMedText}>Add Medication</Text>
              </TouchableOpacity>
            </>
          )}

          {responseType === 'visit' && (
            <>
              <Text style={s.fieldLabel}>VISIT DATE</Text>
              <TextInput style={s.input} value={visitDate} onChangeText={setVisitDate} placeholder="e.g. 2026-03-15" placeholderTextColor={theme.textSecondary} />
            </>
          )}

          <Text style={s.fieldLabel}>INSTRUCTIONS</Text>
          <TextInput style={[s.input, s.multiline]} value={instructions} onChangeText={setInstructions} placeholder="Additional instructions for the patient" placeholderTextColor={theme.textSecondary} multiline textAlignVertical="top" />

          <Text style={s.fieldLabel}>FOLLOW-UP DATE</Text>
          <TextInput style={s.input} value={followUpDate} onChangeText={setFollowUpDate} placeholder="e.g. 2 weeks" placeholderTextColor={theme.textSecondary} />

          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFF" /> : (
              <View style={s.btnRow}><Send size={18} color="#FFF" /><Text style={s.submitText}>Submit Response</Text></View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: Spacing.md },
  patientBanner: { backgroundColor: '#E8EEFF', borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.lg },
  bannerName: { fontSize: FontSizes.base, fontWeight: '700', color: '#0033A0' },
  bannerMeta: { fontSize: FontSizes.sm, color: '#0033A0', marginTop: 2 },
  bannerComplaint: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: Spacing.sm, fontStyle: 'italic' },
  errBox: { backgroundColor: theme.errorBg, padding: Spacing.md, borderRadius: 6, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error },
  errText: { color: theme.error, fontSize: FontSizes.md },
  fieldLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  typeActive: { backgroundColor: '#0033A0', borderColor: '#0033A0' },
  typeText: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textSecondary },
  typeTextActive: { color: '#FFF' },
  input: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: Spacing.sm },
  multiline: { height: 100, textAlignVertical: 'top', paddingTop: Spacing.md },
  medRow: { backgroundColor: theme.inputBg, borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.md },
  medRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  medRowLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textPrimary },
  medInput: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: Spacing.md, height: 44, fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: Spacing.sm },
  medFields: { flexDirection: 'row', gap: Spacing.sm },
  addMedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary, borderStyle: 'dashed', borderRadius: 8, height: 44, gap: 6, marginBottom: Spacing.md },
  addMedText: { fontSize: FontSizes.md, color: theme.primary, fontWeight: '600' },
  submitBtn: { backgroundColor: '#0033A0', height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  doneTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, marginTop: Spacing.lg },
  doneDesc: { fontSize: FontSizes.md, color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  doneBtn: { backgroundColor: '#0033A0', height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, width: '100%' },
  doneBtnText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
});
