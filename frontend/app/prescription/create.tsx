import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import {
  ChevronLeft, Lock, Pill, Plus, Trash2, Send, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, User, QrCode,
} from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Med { name: string; dose: string; route: string; frequency: string; duration: string; instructions: string; plain_instructions: string; }

const ROUTE_OPTIONS = ['PO', 'IV', 'IM', 'TOP', 'INH', 'SL'];
const FREQ_OPTIONS = ['OD (Once daily)', 'BD (Twice daily)', 'TID (3x daily)', 'QID (4x daily)', 'HS (Bedtime)', 'SOS (As needed)'];

export default function PrescriptionCreateScreen() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [patientId, setPatientId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [medications, setMedications] = useState<Med[]>([{
    name: '', dose: '', route: 'PO', frequency: '', duration: '', instructions: '', plain_instructions: '',
  }]);
  const [generalAdvice, setGeneralAdvice] = useState('');
  const [warnings, setWarnings] = useState<string[]>(['']);
  const [followUpDate, setFollowUpDate] = useState('');
  const [testsBeforeNext, setTestsBeforeNext] = useState('');
  const [pharmacyNotes, setPharmacyNotes] = useState('');
  const [validDays, setValidDays] = useState('30');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rxId, setRxId] = useState('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ meds: true, advice: true, warnings: true, followup: false, pharmacy: false });
  const toggleSection = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const addMed = () => setMedications(prev => [...prev, { name: '', dose: '', route: 'PO', frequency: '', duration: '', instructions: '', plain_instructions: '' }]);
  const removeMed = (i: number) => setMedications(prev => prev.filter((_, j) => j !== i));
  const updateMed = (i: number, field: keyof Med, val: string) =>
    setMedications(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m));

  const addWarning = () => setWarnings(prev => [...prev, '']);
  const removeWarning = (i: number) => setWarnings(prev => prev.filter((_, j) => j !== i));

  const handleSend = async () => {
    if (!patientId.trim()) { setError('Patient ID is required'); return; }
    if (!diagnosis.trim()) { setError('Diagnosis is required'); return; }
    if (medications.every(m => !m.name.trim())) { setError('At least one medication is required'); return; }

    setSending(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/prescriptions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          patient_id: patientId.trim().toUpperCase(),
          diagnosis: diagnosis.trim(),
          icd_code: icdCode.trim(),
          medications: medications.filter(m => m.name.trim()),
          general_advice: generalAdvice.trim(),
          warnings: warnings.filter(w => w.trim()),
          follow_up_date: followUpDate.trim(),
          tests_before_next_visit: testsBeforeNext.trim(),
          pharmacy_notes: pharmacyNotes.trim(),
          valid_days: parseInt(validDays) || 30,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRxId(data.id);
        setSuccess(true);
      } else {
        const e = await res.json();
        setError(e.detail || 'Failed to create prescription');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    }
    setSending(false);
  };

  const SectionHeader = ({ title, sectionKey, icon }: { title: string; sectionKey: string; icon: React.ReactNode }) => (
    <TouchableOpacity style={st.sectionBar} onPress={() => toggleSection(sectionKey)} activeOpacity={0.7}>
      <View style={st.sectionBarLeft}>{icon}<Text style={st.sectionBarTitle}>{title}</Text></View>
      {expanded[sectionKey] ? <ChevronUp size={18} color="#FFF" /> : <ChevronDown size={18} color="#FFF" />}
    </TouchableOpacity>
  );

  if (success) return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.doneContainer}>
        <CheckCircle size={48} color="#059659" />
        <Text style={st.doneTitle}>Prescription Sent!</Text>
        <Text style={st.doneDesc}>Prescription {rxId} has been sent to the patient with QR verification.</Text>
        <View style={st.qrInfo}>
          <QrCode size={20} color="#0033A0" />
          <Text style={st.qrText}>QR Code embedded with your license number ({user?.license_number}) for pharmacy verification.</Text>
        </View>
        <TouchableOpacity style={st.primaryBtn} onPress={() => router.push({ pathname: '/prescription/[id]', params: { id: rxId } })}>
          <Text style={st.primaryBtnText}>View Prescription</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.secondaryBtn} onPress={() => { setSuccess(false); setRxId(''); setPatientId(''); setDiagnosis(''); setIcdCode(''); setMedications([{ name: '', dose: '', route: 'PO', frequency: '', duration: '', instructions: '', plain_instructions: '' }]); setGeneralAdvice(''); setWarnings(['']); }}>
          <Plus size={16} color="#0033A0" /><Text style={st.secondaryBtnText}>Write Another Prescription</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.secondaryBtn} onPress={() => router.back()}>
          <Text style={st.secondaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={st.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <ChevronLeft size={20} color={theme.textPrimary} /><Text style={st.backText}>Back</Text>
          </TouchableOpacity>
          <View style={st.topBadges}>
            <View style={st.e2eeBadge}><Lock size={10} color="#10B981" /><Text style={st.e2eeText}>E2EE</Text></View>
            <View style={st.qrBadge}><QrCode size={10} color="#0033A0" /><Text style={st.qrBadgeText}>QR</Text></View>
          </View>
        </View>

        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
          <Text style={st.title}>New Prescription</Text>
          <Text style={st.subtitle}>Create and send an E2EE prescription with QR-verified license number.</Text>

          {error ? <View style={st.errBox}><AlertTriangle size={14} color={theme.error} /><Text style={st.errText}>{error}</Text></View> : null}

          {/* Patient & Diagnosis */}
          <View style={st.card}>
            <View style={st.row2}>
              <View style={st.field}><Text style={st.label}>PATIENT ID *</Text><TextInput style={st.input} value={patientId} onChangeText={setPatientId} placeholder="PAT-XXXXXX" placeholderTextColor={theme.textSecondary} autoCapitalize="characters" /></View>
              <View style={st.field}><Text style={st.label}>VALID FOR (DAYS)</Text><TextInput style={st.input} value={validDays} onChangeText={setValidDays} placeholder="30" keyboardType="numeric" placeholderTextColor={theme.textSecondary} /></View>
            </View>
            <Text style={st.label}>DIAGNOSIS *</Text>
            <TextInput style={st.input} value={diagnosis} onChangeText={setDiagnosis} placeholder="Primary diagnosis" placeholderTextColor={theme.textSecondary} />
            <View style={st.row2}>
              <View style={[st.field, { flex: 1 }]}><Text style={st.label}>ICD-10 CODE</Text><TextInput style={st.input} value={icdCode} onChangeText={setIcdCode} placeholder="e.g. J02.9" placeholderTextColor={theme.textSecondary} /></View>
              <View style={{ flex: 1 }} />
            </View>
          </View>

          {/* Medications */}
          <SectionHeader title={`Medications (${medications.length})`} sectionKey="meds" icon={<Pill size={16} color="#FFF" />} />
          {expanded.meds && (
            <View style={st.sectionContent}>
              {medications.map((m, i) => (
                <View key={i} style={st.medCard}>
                  <View style={st.medHeader}>
                    <Text style={st.medTitle}>Medication #{i + 1}</Text>
                    {medications.length > 1 && <TouchableOpacity onPress={() => removeMed(i)}><Trash2 size={14} color={theme.error} /></TouchableOpacity>}
                  </View>
                  <TextInput style={st.medInput} value={m.name} onChangeText={v => updateMed(i, 'name', v)} placeholder="Drug name *" placeholderTextColor={theme.textSecondary} />
                  <View style={st.row3}>
                    <View style={st.field}><TextInput style={st.medInput} value={m.dose} onChangeText={v => updateMed(i, 'dose', v)} placeholder="Dose" placeholderTextColor={theme.textSecondary} /></View>
                    <View style={st.field}><TextInput style={st.medInput} value={m.route} onChangeText={v => updateMed(i, 'route', v)} placeholder="Route" placeholderTextColor={theme.textSecondary} /></View>
                    <View style={st.field}><TextInput style={st.medInput} value={m.duration} onChangeText={v => updateMed(i, 'duration', v)} placeholder="Duration" placeholderTextColor={theme.textSecondary} /></View>
                  </View>
                  <TextInput style={st.medInput} value={m.frequency} onChangeText={v => updateMed(i, 'frequency', v)} placeholder="Frequency (e.g. BD, TID)" placeholderTextColor={theme.textSecondary} />
                  <TextInput style={st.medInput} value={m.instructions} onChangeText={v => updateMed(i, 'instructions', v)} placeholder="Clinical instructions" placeholderTextColor={theme.textSecondary} />
                  <TextInput style={[st.medInput, { height: 60 }]} value={m.plain_instructions} onChangeText={v => updateMed(i, 'plain_instructions', v)} placeholder="Simple language instructions for patient" placeholderTextColor={theme.textSecondary} multiline textAlignVertical="top" />
                </View>
              ))}
              <TouchableOpacity style={st.addBtn} onPress={addMed}>
                <Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add Medication</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Advice */}
          <SectionHeader title="Advice & Instructions" sectionKey="advice" icon={<User size={16} color="#FFF" />} />
          {expanded.advice && (
            <View style={st.sectionContent}>
              <Text style={st.label}>GENERAL ADVICE</Text>
              <TextInput style={[st.input, { height: 80 }]} value={generalAdvice} onChangeText={setGeneralAdvice} multiline textAlignVertical="top" placeholder="Rest, diet, lifestyle..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* Warnings */}
          <SectionHeader title="Warning Signs" sectionKey="warnings" icon={<AlertTriangle size={16} color="#FFF" />} />
          {expanded.warnings && (
            <View style={st.sectionContent}>
              {warnings.map((w, i) => (
                <View key={i} style={st.warnRow}>
                  <TextInput style={[st.input, { flex: 1 }]} value={w} onChangeText={v => setWarnings(prev => prev.map((s, j) => j === i ? v : s))} placeholder={`Warning sign ${i + 1}`} placeholderTextColor={theme.textSecondary} />
                  {warnings.length > 1 && <TouchableOpacity onPress={() => removeWarning(i)} style={{ padding: 6 }}><Trash2 size={14} color={theme.error} /></TouchableOpacity>}
                </View>
              ))}
              <TouchableOpacity style={st.addBtn} onPress={addWarning}><Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add Warning</Text></TouchableOpacity>
            </View>
          )}

          {/* Follow-up & Pharmacy */}
          <SectionHeader title="Follow-up & Pharmacy" sectionKey="followup" icon={<Pill size={16} color="#FFF" />} />
          {expanded.followup && (
            <View style={st.sectionContent}>
              <View style={st.row2}>
                <View style={st.field}><Text style={st.label}>FOLLOW-UP DATE</Text><TextInput style={st.input} value={followUpDate} onChangeText={setFollowUpDate} placeholder="e.g. 14 April 2026" placeholderTextColor={theme.textSecondary} /></View>
                <View style={st.field}><Text style={st.label}>TESTS BEFORE VISIT</Text><TextInput style={st.input} value={testsBeforeNext} onChangeText={setTestsBeforeNext} placeholder="CBC, etc." placeholderTextColor={theme.textSecondary} /></View>
              </View>
              <Text style={st.label}>PHARMACY NOTES</Text>
              <TextInput style={[st.input, { height: 60 }]} value={pharmacyNotes} onChangeText={setPharmacyNotes} multiline textAlignVertical="top" placeholder="Notes for pharmacist..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity style={st.sendBtn} onPress={handleSend} disabled={sending} activeOpacity={0.8}>
            {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={18} color="#FFF" />}
            <Text style={st.sendBtnText}>Send Prescription (E2EE)</Text>
          </TouchableOpacity>

          <View style={st.footerInfo}>
            <Lock size={12} color="#10B981" />
            <Text style={st.footerText}>QR code with license {user?.license_number || 'N/A'} will be embedded for pharmacy verification</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  topBadges: { flexDirection: 'row', gap: 6 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  qrBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  qrBadgeText: { fontSize: FontSizes.xs, color: '#0033A0', fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: Spacing.md, borderRadius: 8, gap: 8, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: theme.error },
  errText: { color: theme.error, fontSize: FontSizes.md, flex: 1 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.md },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1, marginBottom: 4, marginTop: Spacing.sm },
  input: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: Spacing.md, height: 44, fontSize: FontSizes.base, color: theme.textPrimary },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  row3: { flexDirection: 'row', gap: Spacing.sm },
  field: { flex: 1 },
  sectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0033A0', paddingHorizontal: Spacing.base, paddingVertical: 10, borderRadius: 8, marginTop: Spacing.md },
  sectionBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionBarTitle: { fontSize: FontSizes.base, fontWeight: '700', color: '#FFF' },
  sectionContent: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTopWidth: 0, padding: Spacing.base, marginBottom: Spacing.sm },
  medCard: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.sm, marginBottom: Spacing.sm },
  medHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  medTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: '#0033A0' },
  medInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: Spacing.sm, height: 38, fontSize: FontSizes.sm, color: theme.textPrimary, marginBottom: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EEFF', paddingVertical: 10, borderRadius: 8, gap: 6, marginTop: Spacing.sm },
  addBtnText: { fontSize: FontSizes.base, color: '#0033A0', fontWeight: '600' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', height: 54, borderRadius: 9999, gap: Spacing.sm, marginTop: Spacing.xl },
  sendBtnText: { color: '#FFF', fontSize: FontSizes.lg, fontWeight: '700' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg },
  footerText: { fontSize: FontSizes.sm, color: theme.textSecondary, flex: 1 },
  doneContainer: { padding: Spacing.lg, alignItems: 'center', paddingTop: 80 },
  doneTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, marginTop: Spacing.lg },
  doneDesc: { fontSize: FontSizes.md, color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  qrInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', padding: Spacing.base, borderRadius: 10, gap: Spacing.sm, marginTop: Spacing.lg, width: '100%' },
  qrText: { fontSize: FontSizes.sm, color: '#0033A0', flex: 1 },
  primaryBtn: { backgroundColor: '#0033A0', height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, width: '100%' },
  primaryBtnText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#0033A0', height: 48, borderRadius: 9999, gap: 6, marginTop: Spacing.md, width: '100%' },
  secondaryBtnText: { fontSize: FontSizes.base, color: '#0033A0', fontWeight: '600' },
});
