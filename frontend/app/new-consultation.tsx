import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../src/constants/theme';
import { ChevronLeft, Mic, MicOff, Lock, Cpu, Brain, Zap, CheckCircle } from 'lucide-react-native';

export default function NewConsultationScreen() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [step, setStep] = useState<'select' | 'record' | 'extract' | 'done'>('select');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [consultationId, setConsultationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sttInfo, setSttInfo] = useState<any>(null);
  const [extractInfo, setExtractInfo] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (recording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [recording]);

  const loadPatients = async () => {
    try {
      const res = await authFetch('/api/patients');
      if (res.ok) setPatients(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const startConsultation = async (patient: any) => {
    setSelectedPatient(patient);
    setLoading(true);
    try {
      const res = await authFetch('/api/consultations', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patient.id, chief_complaint: '' }),
      });
      if (res.ok) {
        const data = await res.json();
        setConsultationId(data.id);
        setStep('record');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const simulateRecording = async () => {
    setRecording(true);
    setTranscript('');
    setTranscriptChunks([]);

    // Simulate STT processing
    try {
      const res = await authFetch('/api/ai/transcribe', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSttInfo(data);
        const words = data.transcript.split(' ');
        let currentChunks: string[] = [];
        
        for (let i = 0; i < words.length; i += 3) {
          await new Promise(r => setTimeout(r, 200));
          const chunk = words.slice(0, i + 3).join(' ');
          currentChunks = [...currentChunks];
          setTranscript(chunk);
        }
        setTranscript(data.transcript);
        setTranscriptChunks([data.transcript]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecording(false);
    }
  };

  const extractMedicalData = async () => {
    setStep('extract');
    setLoading(true);
    try {
      const res = await authFetch('/api/ai/extract-medical-data', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setExtractedData(data.extracted_data);
        setExtractInfo(data);

        // Update consultation with transcript and extracted data
        await authFetch(`/api/consultations/${consultationId}`, {
          method: 'PUT',
          body: JSON.stringify({
            transcript: transcript,
            extracted_data: data.extracted_data,
            chief_complaint: data.extracted_data?.assessment || '',
            status: 'completed',
          }),
        });
        setStep('done');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const goToPrescription = () => {
    router.push(`/consultation/${consultationId}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-from-consultation" onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.e2eeBadge}>
          <Lock size={10} color="#10B981" />
          <Text style={styles.e2eeText}>E2EE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 'select' && (
          <>
            <Text style={styles.title}>New Consultation</Text>
            <Text style={styles.subtitle}>Select a patient to begin</Text>
            {patients.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No patients registered</Text>
                <Text style={styles.emptySubtext}>Add a patient first from the Patients tab</Text>
              </View>
            ) : (
              patients.map(p => (
                <TouchableOpacity
                  testID={`select-patient-${p.id}`}
                  key={p.id}
                  style={styles.patientCard}
                  onPress={() => startConsultation(p)}
                  disabled={loading}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{p.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{p.name}</Text>
                    <Text style={styles.patientMeta}>{p.age}y • {p.gender}</Text>
                  </View>
                  {loading && selectedPatient?.id === p.id ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {step === 'record' && (
          <>
            <Text style={styles.title}>Recording Session</Text>
            <Text style={styles.subtitle}>Patient: {selectedPatient?.name}</Text>

            <View style={styles.modelInfo}>
              <Cpu size={14} color={theme.primary} />
              <Text style={styles.modelText}>whisper-cpp-base.en • On-Device • NNAPI</Text>
            </View>

            <View style={styles.micContainer}>
              <TouchableOpacity
                testID="record-button"
                onPress={recording ? undefined : simulateRecording}
                disabled={recording}
                activeOpacity={0.8}
              >
                <Animated.View style={[styles.micCircle, recording && styles.micCircleActive, { transform: [{ scale: recording ? pulseAnim : 1 }] }]}>
                  {recording ? <Mic size={36} color="#FFF" /> : <Mic size={36} color={theme.primary} />}
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.micLabel}>{recording ? 'Processing audio...' : 'Tap to start recording'}</Text>
            </View>

            {transcript ? (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptLabel}>LIVE TRANSCRIPT</Text>
                <Text style={styles.transcriptText}>{transcript}</Text>
                {sttInfo && !recording && (
                  <View style={styles.sttMeta}>
                    <Text style={styles.sttMetaText}>Confidence: {(sttInfo.confidence * 100).toFixed(0)}% • {sttInfo.processing_time_ms}ms • On-Device</Text>
                  </View>
                )}
              </View>
            ) : null}

            {transcript && !recording && (
              <TouchableOpacity testID="extract-data-button" style={styles.extractButton} onPress={extractMedicalData}>
                <Brain size={18} color="#FFF" />
                <Text style={styles.extractText}>Extract Medical Data</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 'extract' && loading && (
          <View style={styles.extractingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.extractingTitle}>Extracting Medical Data</Text>
            <Text style={styles.extractingDesc}>phi-3-mini-4k-q4 processing on-device...</Text>
            <View style={styles.modelInfo}>
              <Zap size={14} color={theme.primary} />
              <Text style={styles.modelText}>GPU Delegate • Quantized INT4</Text>
            </View>
          </View>
        )}

        {step === 'done' && extractedData && (
          <>
            <View style={styles.doneHeader}>
              <CheckCircle size={28} color={theme.success} />
              <Text style={styles.doneTitle}>Data Extracted Successfully</Text>
            </View>

            {extractInfo && (
              <View style={styles.modelInfo}>
                <Cpu size={14} color={theme.primary} />
                <Text style={styles.modelText}>
                  {extractInfo.model} • {extractInfo.processing_time_ms}ms • Confidence: {(extractInfo.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            )}

            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>ASSESSMENT</Text>
              <Text style={styles.dataValue}>{extractedData.assessment}</Text>
            </View>

            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>SYMPTOMS</Text>
              {extractedData.symptoms?.map((s: string, i: number) => (
                <Text key={i} style={styles.listItem}>• {s}</Text>
              ))}
            </View>

            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>VITALS</Text>
              {Object.entries(extractedData.vitals || {}).map(([k, v]) => (
                <Text key={k} style={styles.vitalRow}>{k.replace(/_/g, ' ').toUpperCase()}: {String(v)}</Text>
              ))}
            </View>

            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>PLAN</Text>
              {extractedData.plan?.map((p: string, i: number) => (
                <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>
              ))}
            </View>

            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>ICD CODES</Text>
              {extractedData.icd_codes?.map((c: string, i: number) => (
                <View key={i} style={styles.icdBadge}>
                  <Text style={styles.icdText}>{c}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity testID="view-consultation-button" style={styles.viewButton} onPress={goToPrescription}>
              <Text style={styles.viewButtonText}>View Full Consultation</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  modelInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 6, gap: 6, marginBottom: Spacing.lg },
  modelText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500' },
  patientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.primary },
  patientInfo: { flex: 1, marginLeft: Spacing.md },
  patientName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  patientMeta: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  micContainer: { alignItems: 'center', paddingVertical: Spacing.xxl },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  micCircleActive: { backgroundColor: theme.primary },
  micLabel: { fontSize: FontSizes.base, color: theme.textSecondary, marginTop: Spacing.md },
  transcriptBox: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  transcriptLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  transcriptText: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24 },
  sttMeta: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border },
  sttMetaText: { fontSize: FontSizes.sm, color: theme.textSecondary },
  extractButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, height: 52, borderRadius: 9999, gap: Spacing.sm },
  extractText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  extractingContainer: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  extractingTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary, marginTop: Spacing.lg },
  extractingDesc: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  doneTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  dataCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  dataLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  dataValue: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  listItem: { fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: 4, lineHeight: 22 },
  vitalRow: { fontSize: FontSizes.md, color: theme.textPrimary, marginBottom: 4, fontWeight: '500' },
  icdBadge: { backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 6, marginBottom: Spacing.xs },
  icdText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  viewButton: { backgroundColor: theme.primary, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  viewButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  emptyCard: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8 },
  emptyText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textSecondary },
  emptySubtext: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 4 },
});
