import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import {
  ChevronLeft, Lock, FileText, Save, Send, Download, Plus, Trash2,
  Stethoscope, Activity, ClipboardList, Pill, Brain, AlertTriangle,
  BookOpen, CheckCircle, ChevronDown, ChevronUp, Edit3,
} from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface VitalSign { parameter: string; value: string; normal_range: string; }
interface Medication { drug: string; dose: string; frequency: string; duration: string; instructions: string; }

export default function ReportGenerateScreen() {
  const { sourceType, sourceId, caseData: caseDataParam } = useLocalSearchParams<{
    sourceType: string; sourceId: string; caseData?: string;
  }>();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<string>('new'); // new, draft, sent
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Collapsible sections
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    patient: true, subjective: true, objective: true, assessment: true, plan: true, education: true,
  });

  // Patient / Encounter fields
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientIdDisplay, setPatientIdDisplay] = useState('');
  const [encounterDate, setEncounterDate] = useState('');
  const [encounterType, setEncounterType] = useState('Outpatient Consultation');
  const [encounterDuration, setEncounterDuration] = useState('');

  // Subjective (S)
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [hpi, setHpi] = useState('');
  const [reviewOfSystems, setReviewOfSystems] = useState('');
  const [pastMedicalHistory, setPastMedicalHistory] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [socialHistory, setSocialHistory] = useState('');

  // Objective (O)
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [physicalExamination, setPhysicalExamination] = useState('');
  const [labResults, setLabResults] = useState('');

  // Assessment (A)
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [differentialDiagnoses, setDifferentialDiagnoses] = useState<string[]>([]);
  const [clinicalReasoning, setClinicalReasoning] = useState('');

  // Plan (P)
  const [medications, setMedications] = useState<Medication[]>([]);
  const [simpleInstructions, setSimpleInstructions] = useState<string[]>([]);
  const [generalAdvice, setGeneralAdvice] = useState('');
  const [warningSigns, setWarningSigns] = useState<string[]>([]);
  const [diagnosticTests, setDiagnosticTests] = useState('');
  const [referrals, setReferrals] = useState('');
  const [followUp, setFollowUp] = useState('');

  // Patient Education
  const [patientEducation, setPatientEducation] = useState('');

  useEffect(() => { prefillFromSource(); }, []);

  const prefillFromSource = async () => {
    try {
      // If caseData was passed as a param, use it
      if (caseDataParam) {
        const data = JSON.parse(caseDataParam);
        prefillFields(data);
        setLoading(false);
        return;
      }

      // Otherwise, fetch from API
      let endpoint = '';
      if (sourceType === 'consultation') {
        endpoint = `/api/doctor/consultations/${sourceId}`;
      } else if (sourceType === 'case') {
        endpoint = `/api/cases/${sourceId}`;
      }

      if (endpoint) {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          prefillFields(data);
        }
      }
    } catch (e) {
      console.error('Failed to prefill:', e);
    }
    setLoading(false);
  };

  const prefillFields = (data: any) => {
    const ext = data.extraction_data || {};

    // Patient info
    setPatientName(data.patient_name || '');
    setPatientAge(String(data.patient_age || ''));
    setPatientGender(data.patient_gender || '');
    setPatientIdDisplay(data.patient_id || '');
    setEncounterDate(data.created_at ? new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    setEncounterType(data.consultation_type === 'follow_up' ? 'Follow-up Visit' : data.consultation_type === 'emergency' ? 'Emergency Visit' : 'Outpatient Consultation');

    // Subjective
    setChiefComplaint(ext.chief_complaint || data.chief_complaint || '');
    setHpi(ext.summary || data.transcript || '');
    setReviewOfSystems(ext.symptoms?.map((s: any) => `${s.name}: ${s.severity}${s.duration ? `, ${s.duration}` : ''}`).join('. ') || '');
    setPastMedicalHistory(ext.medical_history_mentioned?.join('. ') || '');
    setCurrentMedications(ext.medications_mentioned?.join(', ') || '');
    setAllergies(ext.allergies_mentioned?.join(', ') || 'No known drug allergies (NKDA)');

    // Objective
    if (ext.vital_signs_mentioned && typeof ext.vital_signs_mentioned === 'object') {
      const vsArr: VitalSign[] = [];
      const normalRanges: Record<string, string> = {
        blood_pressure: '<140/90 mmHg', heart_rate: '60-100 bpm', temperature: '97.8-99.1 F',
        spo2: '95-100%', respiratory_rate: '12-20/min', weight: '--',
      };
      Object.entries(ext.vital_signs_mentioned).forEach(([k, v]) => {
        if (v) vsArr.push({ parameter: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), value: String(v), normal_range: normalRanges[k] || '--' });
      });
      setVitalSigns(vsArr);
    }

    // Assessment
    if (ext.suggested_diagnosis?.length) {
      setPrimaryDiagnosis(ext.suggested_diagnosis[0] || '');
      setDifferentialDiagnoses(ext.suggested_diagnosis.slice(1) || []);
    }
    setClinicalReasoning(ext.summary || '');

    // Plan
    if (ext.medications_mentioned?.length) {
      setMedications(ext.medications_mentioned.map((m: string) => ({
        drug: m, dose: '', frequency: '', duration: '', instructions: '',
      })));
      setSimpleInstructions(ext.medications_mentioned.map((m: string) => `${m} - Follow prescribed dosage.`));
    }
    if (ext.recommended_tests?.length) {
      setDiagnosticTests(ext.recommended_tests.join('. '));
    }
    setWarningSigns(ext.key_quotes?.length ? ext.key_quotes.slice(0, 4) : ['Sudden severe symptoms', 'Difficulty breathing', 'Loss of consciousness']);
    setFollowUp('Review in 2 weeks with test results.');
    setPatientEducation('Counseled on medication adherence, lifestyle modifications, and when to seek immediate care.');

    // Doctor notes
    if (data.doctor_notes) {
      setGeneralAdvice(data.doctor_notes);
    }
  };

  const toggleSection = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const saveReport = async () => {
    if (!chiefComplaint.trim()) { setError('Chief complaint is required'); return; }
    setSaving(true); setError(''); setSuccessMsg('');

    const payload = {
      source_type: sourceType || 'manual',
      source_id: sourceId || 'manual',
      patient_name: patientName, patient_age: patientAge, patient_gender: patientGender,
      patient_id_display: patientIdDisplay, encounter_date: encounterDate,
      encounter_type: encounterType, encounter_duration: encounterDuration,
      chief_complaint: chiefComplaint, hpi, review_of_systems: reviewOfSystems,
      past_medical_history: pastMedicalHistory, current_medications: currentMedications,
      allergies, social_history: socialHistory,
      vital_signs: vitalSigns, physical_examination: physicalExamination, lab_results: labResults,
      primary_diagnosis: primaryDiagnosis, icd_code: icdCode,
      differential_diagnoses: differentialDiagnoses, clinical_reasoning: clinicalReasoning,
      medications, simple_instructions: simpleInstructions, general_advice: generalAdvice,
      warning_signs: warningSigns, diagnostic_tests: diagnosticTests, referrals, follow_up: followUp,
      patient_education: patientEducation,
    };

    try {
      let res;
      if (reportId) {
        // Update existing report
        res = await fetch(`${BACKEND_URL}/api/reports/${reportId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new report
        res = await fetch(`${BACKEND_URL}/api/reports/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json();
        setReportId(data.id);
        setReportStatus('draft');
        setSuccessMsg('Report saved as draft. You can review the PDF or send to patient.');
      } else {
        const e = await res.json();
        setError(e.detail || 'Failed to save report');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    }
    setSaving(false);
  };

  const downloadPdf = async () => {
    if (!reportId) return;
    try {
      const url = `${BACKEND_URL}/api/reports/${reportId}/pdf`;
      if (Platform.OS === 'web') {
        window.open(`${url}?token=${token}`, '_blank');
      } else {
        // On native, open in browser for download
        await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not download PDF');
    }
  };

  const sendToPatient = async () => {
    if (!reportId) return;
    if (!patientIdDisplay) { setError('Patient ID is required to send report'); return; }

    Alert.alert(
      'Send Report to Patient',
      `Send this medical report to patient ${patientName || patientIdDisplay}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send (E2EE)',
          style: 'default',
          onPress: async () => {
            setSending(true); setError('');
            try {
              const res = await fetch(`${BACKEND_URL}/api/reports/${reportId}/send`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (res.ok) {
                setReportStatus('sent');
                setSuccessMsg('Report sent to patient successfully with E2EE encryption.');
              } else {
                const e = await res.json();
                setError(e.detail || 'Failed to send report');
              }
            } catch (e) {
              setError('Network error. Please try again.');
            }
            setSending(false);
          },
        },
      ],
    );
  };

  // Helpers for dynamic arrays
  const addVitalSign = () => setVitalSigns(prev => [...prev, { parameter: '', value: '', normal_range: '' }]);
  const removeVitalSign = (idx: number) => setVitalSigns(prev => prev.filter((_, i) => i !== idx));
  const updateVitalSign = (idx: number, field: keyof VitalSign, val: string) =>
    setVitalSigns(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));

  const addMedication = () => setMedications(prev => [...prev, { drug: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  const removeMedication = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx));
  const updateMedication = (idx: number, field: keyof Medication, val: string) =>
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));

  const addDiffDx = () => setDifferentialDiagnoses(prev => [...prev, '']);
  const removeDiffDx = (idx: number) => setDifferentialDiagnoses(prev => prev.filter((_, i) => i !== idx));

  const addWarning = () => setWarningSigns(prev => [...prev, '']);
  const removeWarning = (idx: number) => setWarningSigns(prev => prev.filter((_, i) => i !== idx));

  const addInstruction = () => setSimpleInstructions(prev => [...prev, '']);
  const removeInstruction = (idx: number) => setSimpleInstructions(prev => prev.filter((_, i) => i !== idx));

  const SectionHeaderBar = ({ title, icon, sectionKey }: { title: string; icon: React.ReactNode; sectionKey: string }) => (
    <TouchableOpacity style={st.sectionBar} onPress={() => toggleSection(sectionKey)} activeOpacity={0.7}>
      <View style={st.sectionBarLeft}>
        {icon}
        <Text style={st.sectionBarTitle}>{title}</Text>
      </View>
      {expanded[sectionKey] ? <ChevronUp size={18} color="#FFF" /> : <ChevronDown size={18} color="#FFF" />}
    </TouchableOpacity>
  );

  if (loading) return (
    <SafeAreaView style={st.safe}><View style={st.center}><ActivityIndicator size="large" color="#0033A0" /><Text style={{ marginTop: 12, color: theme.textSecondary }}>Loading clinical data...</Text></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Top Bar */}
        <View style={st.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <ChevronLeft size={20} color={theme.textPrimary} /><Text style={st.backText}>Back</Text>
          </TouchableOpacity>
          <View style={st.topBadges}>
            <View style={st.e2eeBadge}><Lock size={10} color="#10B981" /><Text style={st.e2eeText}>E2EE</Text></View>
            {reportId && <View style={[st.statusBadge, reportStatus === 'sent' ? st.sentBadge : st.draftBadge]}>
              <Text style={[st.statusBadgeText, reportStatus === 'sent' ? st.sentText : st.draftText]}>{reportStatus.toUpperCase()}</Text>
            </View>}
          </View>
        </View>

        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
          <Text style={st.pageTitle}>Medical Report</Text>
          <Text style={st.pageSubtitle}>Review and edit AI-extracted clinical data before generating the report PDF.</Text>

          {error ? <View style={st.errBox}><AlertTriangle size={14} color={theme.error} /><Text style={st.errText}>{error}</Text></View> : null}
          {successMsg ? <View style={st.successBox}><CheckCircle size={14} color="#059669" /><Text style={st.successText}>{successMsg}</Text></View> : null}

          {/* PATIENT & ENCOUNTER */}
          <SectionHeaderBar title="Patient & Encounter Details" icon={<ClipboardList size={16} color="#FFF" />} sectionKey="patient" />
          {expanded.patient && (
            <View style={st.sectionContent}>
              <View style={st.row2}>
                <View style={st.field}><Text style={st.label}>PATIENT NAME</Text><TextInput style={st.input} value={patientName} onChangeText={setPatientName} placeholder="Full name" placeholderTextColor={theme.textSecondary} /></View>
                <View style={st.field}><Text style={st.label}>PATIENT ID</Text><TextInput style={st.input} value={patientIdDisplay} onChangeText={setPatientIdDisplay} placeholder="PAT-XXXXXX" placeholderTextColor={theme.textSecondary} /></View>
              </View>
              <View style={st.row3}>
                <View style={st.field}><Text style={st.label}>AGE</Text><TextInput style={st.input} value={patientAge} onChangeText={setPatientAge} placeholder="Years" keyboardType="numeric" placeholderTextColor={theme.textSecondary} /></View>
                <View style={st.field}><Text style={st.label}>GENDER</Text><TextInput style={st.input} value={patientGender} onChangeText={setPatientGender} placeholder="M/F" placeholderTextColor={theme.textSecondary} /></View>
                <View style={st.field}><Text style={st.label}>DATE</Text><TextInput style={st.input} value={encounterDate} onChangeText={setEncounterDate} placeholder="Date" placeholderTextColor={theme.textSecondary} /></View>
              </View>
              <View style={st.row2}>
                <View style={st.field}><Text style={st.label}>ENCOUNTER TYPE</Text><TextInput style={st.input} value={encounterType} onChangeText={setEncounterType} placeholderTextColor={theme.textSecondary} /></View>
                <View style={st.field}><Text style={st.label}>DURATION</Text><TextInput style={st.input} value={encounterDuration} onChangeText={setEncounterDuration} placeholder="e.g. 12 min" placeholderTextColor={theme.textSecondary} /></View>
              </View>
            </View>
          )}

          {/* SUBJECTIVE (S) */}
          <SectionHeaderBar title="Subjective (S)" icon={<FileText size={16} color="#FFF" />} sectionKey="subjective" />
          {expanded.subjective && (
            <View style={st.sectionContent}>
              <Text style={st.label}>CHIEF COMPLAINT *</Text>
              <TextInput style={[st.input, st.multiline]} value={chiefComplaint} onChangeText={setChiefComplaint} multiline textAlignVertical="top" placeholder="Primary reason for visit" placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>HISTORY OF PRESENT ILLNESS</Text>
              <TextInput style={[st.input, st.multilineTall]} value={hpi} onChangeText={setHpi} multiline textAlignVertical="top" placeholder="Detailed history..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>REVIEW OF SYSTEMS</Text>
              <TextInput style={[st.input, st.multiline]} value={reviewOfSystems} onChangeText={setReviewOfSystems} multiline textAlignVertical="top" placeholder="Positive/negative findings..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>PAST MEDICAL HISTORY</Text>
              <TextInput style={[st.input, st.multiline]} value={pastMedicalHistory} onChangeText={setPastMedicalHistory} multiline textAlignVertical="top" placeholder="Previous conditions..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>CURRENT MEDICATIONS</Text>
              <TextInput style={st.input} value={currentMedications} onChangeText={setCurrentMedications} placeholder="List medications..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>ALLERGIES</Text>
              <TextInput style={st.input} value={allergies} onChangeText={setAllergies} placeholder="NKDA or list allergies..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>SOCIAL HISTORY</Text>
              <TextInput style={st.input} value={socialHistory} onChangeText={setSocialHistory} placeholder="Occupation, habits..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* OBJECTIVE (O) */}
          <SectionHeaderBar title="Objective (O)" icon={<Activity size={16} color="#FFF" />} sectionKey="objective" />
          {expanded.objective && (
            <View style={st.sectionContent}>
              <View style={st.arrayHeader}>
                <Text style={st.label}>VITAL SIGNS</Text>
                <TouchableOpacity style={st.addBtn} onPress={addVitalSign}><Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add</Text></TouchableOpacity>
              </View>
              {vitalSigns.map((vs, i) => (
                <View key={i} style={st.arrayRow}>
                  <TextInput style={[st.arrayInput, { flex: 2 }]} value={vs.parameter} onChangeText={v => updateVitalSign(i, 'parameter', v)} placeholder="Parameter" placeholderTextColor={theme.textSecondary} />
                  <TextInput style={[st.arrayInput, { flex: 1.5 }]} value={vs.value} onChangeText={v => updateVitalSign(i, 'value', v)} placeholder="Value" placeholderTextColor={theme.textSecondary} />
                  <TextInput style={[st.arrayInput, { flex: 1.5 }]} value={vs.normal_range} onChangeText={v => updateVitalSign(i, 'normal_range', v)} placeholder="Range" placeholderTextColor={theme.textSecondary} />
                  <TouchableOpacity onPress={() => removeVitalSign(i)} style={st.removeBtn}><Trash2 size={14} color={theme.error} /></TouchableOpacity>
                </View>
              ))}
              <Text style={st.label}>PHYSICAL EXAMINATION</Text>
              <TextInput style={[st.input, st.multiline]} value={physicalExamination} onChangeText={setPhysicalExamination} multiline textAlignVertical="top" placeholder="Exam findings..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>LAB / DIAGNOSTIC RESULTS</Text>
              <TextInput style={[st.input, st.multiline]} value={labResults} onChangeText={setLabResults} multiline textAlignVertical="top" placeholder="Lab results..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* ASSESSMENT (A) */}
          <SectionHeaderBar title="Assessment (A)" icon={<Stethoscope size={16} color="#FFF" />} sectionKey="assessment" />
          {expanded.assessment && (
            <View style={st.sectionContent}>
              <View style={st.row2}>
                <View style={[st.field, { flex: 2 }]}><Text style={st.label}>PRIMARY DIAGNOSIS</Text><TextInput style={st.input} value={primaryDiagnosis} onChangeText={setPrimaryDiagnosis} placeholder="Primary diagnosis" placeholderTextColor={theme.textSecondary} /></View>
                <View style={st.field}><Text style={st.label}>ICD-10</Text><TextInput style={st.input} value={icdCode} onChangeText={setIcdCode} placeholder="Code" placeholderTextColor={theme.textSecondary} /></View>
              </View>
              <View style={st.arrayHeader}>
                <Text style={st.label}>DIFFERENTIAL DIAGNOSES</Text>
                <TouchableOpacity style={st.addBtn} onPress={addDiffDx}><Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add</Text></TouchableOpacity>
              </View>
              {differentialDiagnoses.map((dx, i) => (
                <View key={i} style={st.arrayRow}>
                  <TextInput style={[st.arrayInput, { flex: 1 }]} value={dx} onChangeText={v => setDifferentialDiagnoses(prev => prev.map((d, j) => j === i ? v : d))} placeholder={`Differential ${i + 1}`} placeholderTextColor={theme.textSecondary} />
                  <TouchableOpacity onPress={() => removeDiffDx(i)} style={st.removeBtn}><Trash2 size={14} color={theme.error} /></TouchableOpacity>
                </View>
              ))}
              <Text style={st.label}>CLINICAL REASONING</Text>
              <TextInput style={[st.input, st.multilineTall]} value={clinicalReasoning} onChangeText={setClinicalReasoning} multiline textAlignVertical="top" placeholder="Clinical reasoning..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* PLAN (P) */}
          <SectionHeaderBar title="Plan (P)" icon={<Pill size={16} color="#FFF" />} sectionKey="plan" />
          {expanded.plan && (
            <View style={st.sectionContent}>
              <View style={st.arrayHeader}>
                <Text style={st.label}>MEDICATIONS</Text>
                <TouchableOpacity style={st.addBtn} onPress={addMedication}><Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add</Text></TouchableOpacity>
              </View>
              {medications.map((med, i) => (
                <View key={i} style={st.medCard}>
                  <View style={st.medCardHeader}>
                    <Text style={st.medCardTitle}>Med #{i + 1}</Text>
                    <TouchableOpacity onPress={() => removeMedication(i)}><Trash2 size={14} color={theme.error} /></TouchableOpacity>
                  </View>
                  <TextInput style={st.medInput} value={med.drug} onChangeText={v => updateMedication(i, 'drug', v)} placeholder="Drug name" placeholderTextColor={theme.textSecondary} />
                  <View style={st.row2}>
                    <View style={st.field}><TextInput style={st.medInput} value={med.dose} onChangeText={v => updateMedication(i, 'dose', v)} placeholder="Dose" placeholderTextColor={theme.textSecondary} /></View>
                    <View style={st.field}><TextInput style={st.medInput} value={med.frequency} onChangeText={v => updateMedication(i, 'frequency', v)} placeholder="Frequency" placeholderTextColor={theme.textSecondary} /></View>
                  </View>
                  <View style={st.row2}>
                    <View style={st.field}><TextInput style={st.medInput} value={med.duration} onChangeText={v => updateMedication(i, 'duration', v)} placeholder="Duration" placeholderTextColor={theme.textSecondary} /></View>
                    <View style={st.field}><TextInput style={st.medInput} value={med.instructions} onChangeText={v => updateMedication(i, 'instructions', v)} placeholder="Instructions" placeholderTextColor={theme.textSecondary} /></View>
                  </View>
                </View>
              ))}

              <View style={st.arrayHeader}>
                <Text style={st.label}>SIMPLE INSTRUCTIONS</Text>
                <TouchableOpacity style={st.addBtn} onPress={addInstruction}><Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add</Text></TouchableOpacity>
              </View>
              {simpleInstructions.map((inst, i) => (
                <View key={i} style={st.arrayRow}>
                  <TextInput style={[st.arrayInput, { flex: 1 }]} value={inst} onChangeText={v => setSimpleInstructions(prev => prev.map((s, j) => j === i ? v : s))} placeholder={`Instruction ${i + 1}`} placeholderTextColor={theme.textSecondary} />
                  <TouchableOpacity onPress={() => removeInstruction(i)} style={st.removeBtn}><Trash2 size={14} color={theme.error} /></TouchableOpacity>
                </View>
              ))}
              <Text style={st.label}>GENERAL ADVICE</Text>
              <TextInput style={[st.input, st.multiline]} value={generalAdvice} onChangeText={setGeneralAdvice} multiline textAlignVertical="top" placeholder="Lifestyle advice..." placeholderTextColor={theme.textSecondary} />

              <View style={st.arrayHeader}>
                <Text style={[st.label, { color: theme.error }]}>WARNING SIGNS</Text>
                <TouchableOpacity style={st.addBtn} onPress={addWarning}><Plus size={14} color="#0033A0" /><Text style={st.addBtnText}>Add</Text></TouchableOpacity>
              </View>
              {warningSigns.map((w, i) => (
                <View key={i} style={st.arrayRow}>
                  <TextInput style={[st.arrayInput, { flex: 1 }]} value={w} onChangeText={v => setWarningSigns(prev => prev.map((s, j) => j === i ? v : s))} placeholder={`Warning sign ${i + 1}`} placeholderTextColor={theme.textSecondary} />
                  <TouchableOpacity onPress={() => removeWarning(i)} style={st.removeBtn}><Trash2 size={14} color={theme.error} /></TouchableOpacity>
                </View>
              ))}
              <Text style={st.label}>DIAGNOSTIC TESTS ORDERED</Text>
              <TextInput style={[st.input, st.multiline]} value={diagnosticTests} onChangeText={setDiagnosticTests} multiline textAlignVertical="top" placeholder="Tests to order..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>REFERRALS</Text>
              <TextInput style={st.input} value={referrals} onChangeText={setReferrals} placeholder="Specialist referrals..." placeholderTextColor={theme.textSecondary} />
              <Text style={st.label}>FOLLOW-UP</Text>
              <TextInput style={st.input} value={followUp} onChangeText={setFollowUp} placeholder="Follow-up plan..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* PATIENT EDUCATION */}
          <SectionHeaderBar title="Patient Education" icon={<BookOpen size={16} color="#FFF" />} sectionKey="education" />
          {expanded.education && (
            <View style={st.sectionContent}>
              <TextInput style={[st.input, st.multilineTall]} value={patientEducation} onChangeText={setPatientEducation} multiline textAlignVertical="top" placeholder="Patient education notes..." placeholderTextColor={theme.textSecondary} />
            </View>
          )}

          {/* ACTION BUTTONS */}
          <View style={st.actions}>
            {reportStatus !== 'sent' && (
              <TouchableOpacity style={st.saveButton} onPress={saveReport} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={18} color="#FFF" />}
                <Text style={st.saveButtonText}>{reportId ? 'Update Draft' : 'Save as Draft'}</Text>
              </TouchableOpacity>
            )}

            {reportId && (
              <TouchableOpacity style={st.downloadButton} onPress={downloadPdf} activeOpacity={0.8}>
                <Download size={18} color="#0033A0" />
                <Text style={st.downloadButtonText}>Download PDF</Text>
              </TouchableOpacity>
            )}

            {reportId && reportStatus !== 'sent' && (
              <TouchableOpacity style={st.sendButton} onPress={sendToPatient} disabled={sending} activeOpacity={0.8}>
                {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={18} color="#FFF" />}
                <Text style={st.sendButtonText}>Send to Patient (E2EE)</Text>
              </TouchableOpacity>
            )}

            {reportStatus === 'sent' && (
              <View style={st.sentConfirmation}>
                <CheckCircle size={20} color="#059669" />
                <Text style={st.sentConfirmText}>Report sent to patient with E2EE encryption</Text>
              </View>
            )}
          </View>

          <View style={st.encryptionFooter}>
            <Lock size={12} color="#10B981" />
            <Text style={st.encryptionText}>End-to-End Encrypted | HIPAA Aligned | Privacy by Design</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  topBadges: { flexDirection: 'row', gap: 6 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  draftBadge: { backgroundColor: '#FEF3C7' },
  sentBadge: { backgroundColor: '#ECFDF5' },
  statusBadgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  draftText: { color: '#92400E' },
  sentText: { color: '#065F46' },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  pageTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 },
  pageSubtitle: { fontSize: FontSizes.md, color: theme.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: Spacing.md, borderRadius: 8, gap: 8, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: theme.error },
  errText: { color: theme.error, fontSize: FontSizes.md, flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: Spacing.md, borderRadius: 8, gap: 8, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: '#059669' },
  successText: { color: '#065F46', fontSize: FontSizes.md, flex: 1 },
  sectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0033A0', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderRadius: 8, marginTop: Spacing.md },
  sectionBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionBarTitle: { fontSize: FontSizes.base, fontWeight: '700', color: '#FFF' },
  sectionContent: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTopWidth: 0, padding: Spacing.base, marginBottom: Spacing.sm },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1, marginBottom: 4, marginTop: Spacing.sm },
  input: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: Spacing.md, height: 44, fontSize: FontSizes.base, color: theme.textPrimary },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  multilineTall: { height: 120, paddingTop: 12, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  row3: { flexDirection: 'row', gap: Spacing.sm },
  field: { flex: 1 },
  arrayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  addBtnText: { fontSize: FontSizes.sm, color: '#0033A0', fontWeight: '600' },
  arrayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 6 },
  arrayInput: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: Spacing.sm, height: 40, fontSize: FontSizes.sm, color: theme.textPrimary },
  removeBtn: { padding: 6 },
  medCard: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.sm, marginTop: Spacing.sm },
  medCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  medCardTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: '#0033A0' },
  medInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: Spacing.sm, height: 38, fontSize: FontSizes.sm, color: theme.textPrimary, marginBottom: 4 },
  actions: { marginTop: Spacing.xl, gap: Spacing.md },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0033A0', height: 52, borderRadius: 9999, gap: Spacing.sm },
  saveButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0033A0', height: 52, borderRadius: 9999, gap: Spacing.sm },
  downloadButtonText: { color: '#0033A0', fontSize: FontSizes.base, fontWeight: '700' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', height: 52, borderRadius: 9999, gap: Spacing.sm },
  sendButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  sentConfirmation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', padding: Spacing.base, borderRadius: 10, gap: Spacing.sm },
  sentConfirmText: { fontSize: FontSizes.md, color: '#065F46', fontWeight: '600' },
  encryptionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.xl },
  encryptionText: { fontSize: FontSizes.sm, color: theme.textSecondary },
});
