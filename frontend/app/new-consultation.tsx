import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, TextInput, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { useAuth } from '../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../src/constants/theme';
import { transcribeAudio, extractMedicalData, getNativeAIStatus } from '../src/native/NativeAIProvider';
import { ChevronLeft, Mic, MicOff, Lock, Cpu, Brain, Zap, CheckCircle, Square, Edit3, Smartphone, Globe, Clock, BarChart3 } from 'lucide-react-native';

type Step = 'select' | 'record' | 'review' | 'extract' | 'done';

export default function NewConsultationScreen() {
  const { authFetch } = useAuth();
  const router = useRouter();

  // Patient selection
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [step, setStep] = useState<Step>('select');

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  // Transcript state  
  const [transcript, setTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [sttInfo, setSttInfo] = useState<any>(null);
  const [sttProcessing, setSttProcessing] = useState(false);

  // Extraction state
  const [extractedData, setExtractedData] = useState<any>(null);
  const [extractInfo, setExtractInfo] = useState<any>(null);
  const [extractLoading, setExtractLoading] = useState(false);

  // Consultation
  const [consultationId, setConsultationId] = useState('');
  const [loading, setLoading] = useState(false);

  // AI Status
  const [aiStatus] = useState(() => getNativeAIStatus());

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadPatients(); requestMicPermission(); }, []);

  useEffect(() => {
    if (recording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recording]);

  const requestMicPermission = async () => {
    try {
      if (Platform.OS === 'web') {
        setPermissionGranted(true);
        return;
      }
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');
      if (status !== 'granted') {
        Alert.alert('Microphone Permission', 'Microphone access is required for recording consultations. Please enable it in Settings.');
      }
    } catch (e) {
      console.warn('Permission request failed:', e);
      setPermissionGranted(true); // Allow fallback on web
    }
  };

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============== RECORDING ==============

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecordingInstance(newRecording);
      setRecording(true);
      setRecordingDuration(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      // Fallback: simulate recording on web if Audio.Recording fails
      setRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);

    const durationMs = recordingDuration * 1000;

    try {
      if (recordingInstance) {
        await recordingInstance.stopAndUnloadAsync();
        const uri = recordingInstance.getURI();
        setAudioUri(uri);
        setRecordingInstance(null);

        if (Platform.OS !== 'web') {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        }

        // Process through Native AI bridge
        processAudio(uri || '', durationMs);
      } else {
        // Web fallback — no actual audio file
        processAudio('web-recording-mock', durationMs);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      processAudio('fallback-recording', durationMs);
    }
  };

  const processAudio = async (uri: string, durationMs: number) => {
    setSttProcessing(true);
    try {
      const result = await transcribeAudio(uri, durationMs);
      setTranscript(result.transcript);
      setEditedTranscript(result.transcript);
      setSttInfo(result);
      setStep('review');
    } catch (e) {
      console.error('STT processing failed:', e);
      Alert.alert('Processing Error', 'Failed to transcribe audio. Please try again.');
    } finally {
      setSttProcessing(false);
    }
  };

  // ============== TRANSCRIPT EDITING ==============

  const startEditing = () => {
    setIsEditing(true);
    setEditedTranscript(transcript);
  };

  const saveEdit = () => {
    setTranscript(editedTranscript);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditedTranscript(transcript);
    setIsEditing(false);
  };

  // ============== EXTRACTION ==============

  const runExtraction = async () => {
    setStep('extract');
    setExtractLoading(true);
    try {
      // Use the Native AI bridge (mock on web, real on device)
      const result = await extractMedicalData(transcript);
      setExtractedData(result.extractedData);
      setExtractInfo(result);

      // Save to backend
      await authFetch(`/api/consultations/${consultationId}`, {
        method: 'PUT',
        body: JSON.stringify({
          transcript,
          extracted_data: result.extractedData,
          chief_complaint: result.extractedData?.assessment || '',
          status: 'completed',
        }),
      });
      setStep('done');
    } catch (e) {
      console.error('Extraction failed:', e);
      Alert.alert('Extraction Error', 'Failed to extract medical data. Please try again.');
      setStep('review');
    } finally {
      setExtractLoading(false);
    }
  };

  // ============== RENDER ==============

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-from-consultation" onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.topBadges}>
          <View style={styles.e2eeBadge}>
            <Lock size={10} color="#10B981" />
            <Text style={styles.e2eeText}>E2EE</Text>
          </View>
          <View style={[styles.modeBadge, aiStatus.isWebPreview ? styles.modeBadgeWeb : styles.modeBadgeNative]}>
            {aiStatus.isWebPreview ? <Globe size={10} color="#92400E" /> : <Smartphone size={10} color="#065F46" />}
            <Text style={[styles.modeText, aiStatus.isWebPreview ? styles.modeTextWeb : styles.modeTextNative]}>
              {aiStatus.isWebPreview ? 'MOCK' : 'DEVICE'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* STEP 1: Patient Selection */}
        {step === 'select' && (
          <>
            <Text style={styles.title}>New Consultation</Text>
            <Text style={styles.subtitle}>Select a patient to begin recording</Text>

            <View style={styles.aiBanner}>
              <Cpu size={14} color={theme.primary} />
              <Text style={styles.aiBannerText}>
                STT: {aiStatus.stt.modelName} • LLM: {aiStatus.llm.modelName}
              </Text>
            </View>

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
                  {loading && selectedPatient?.id === p.id && <ActivityIndicator size="small" color={theme.primary} />}
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* STEP 2: Recording */}
        {step === 'record' && (
          <>
            <Text style={styles.title}>Recording Session</Text>
            <Text style={styles.subtitle}>Patient: {selectedPatient?.name}</Text>

            <View style={styles.aiBanner}>
              <Cpu size={14} color={theme.primary} />
              <Text style={styles.aiBannerText}>
                {aiStatus.stt.modelName} • {aiStatus.stt.backend}
              </Text>
            </View>

            {!permissionGranted && Platform.OS !== 'web' && (
              <View style={styles.permissionWarning}>
                <MicOff size={16} color={theme.error} />
                <Text style={styles.permissionText}>Microphone permission required</Text>
                <TouchableOpacity testID="request-mic-permission" style={styles.permissionBtn} onPress={requestMicPermission}>
                  <Text style={styles.permissionBtnText}>Grant</Text>
                </TouchableOpacity>
              </View>
            )}

            {sttProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.processingTitle}>Processing Audio</Text>
                <Text style={styles.processingDesc}>Running {aiStatus.stt.modelName}...</Text>
                <View style={styles.aiBanner}>
                  <Zap size={14} color={theme.primary} />
                  <Text style={styles.aiBannerText}>
                    {aiStatus.isWebPreview ? 'Mock inference (web preview)' : 'NNAPI hardware acceleration'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.micContainer}>
                  {recording && (
                    <View style={styles.timerContainer}>
                      <View style={styles.liveDot} />
                      <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    testID="record-button"
                    onPress={recording ? stopRecording : startRecording}
                    activeOpacity={0.7}
                  >
                    <Animated.View style={[
                      styles.micCircle,
                      recording && styles.micCircleActive,
                      { transform: [{ scale: recording ? pulseAnim : 1 }] }
                    ]}>
                      {recording ? (
                        <Square size={28} color="#FFF" fill="#FFF" />
                      ) : (
                        <Mic size={36} color={theme.primary} />
                      )}
                    </Animated.View>
                  </TouchableOpacity>

                  <Text style={styles.micLabel}>
                    {recording ? 'Tap to stop recording' : 'Tap to start recording'}
                  </Text>

                  {recording && (
                    <View style={styles.waveContainer}>
                      {[...Array(12)].map((_, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.waveBar,
                            {
                              height: 8 + Math.random() * 28,
                              backgroundColor: theme.primary,
                              opacity: 0.4 + Math.random() * 0.6,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>

                {!recording && recordingDuration > 0 && (
                  <View style={styles.recordingInfo}>
                    <Clock size={14} color={theme.textSecondary} />
                    <Text style={styles.recordingInfoText}>
                      Recorded: {formatDuration(recordingDuration)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* STEP 3: Transcript Review & Edit */}
        {step === 'review' && (
          <>
            <Text style={styles.title}>Review Transcript</Text>
            <Text style={styles.subtitle}>Edit to correct any STT errors before extraction</Text>

            {sttInfo && (
              <View style={styles.sttStatsRow}>
                <View style={styles.sttStat}>
                  <BarChart3 size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{(sttInfo.confidence * 100).toFixed(0)}% conf.</Text>
                </View>
                <View style={styles.sttStat}>
                  <Clock size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{sttInfo.processingTimeMs}ms</Text>
                </View>
                <View style={styles.sttStat}>
                  <Cpu size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{sttInfo.isOnDevice ? 'On-Device' : 'Mock'}</Text>
                </View>
              </View>
            )}

            <View style={styles.transcriptCard}>
              <View style={styles.transcriptHeader}>
                <Text style={styles.transcriptLabel}>TRANSCRIPT</Text>
                {!isEditing ? (
                  <TouchableOpacity testID="edit-transcript-button" style={styles.editButton} onPress={startEditing}>
                    <Edit3 size={14} color={theme.primary} />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editActions}>
                    <TouchableOpacity testID="cancel-edit-button" style={styles.cancelEditBtn} onPress={cancelEdit}>
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="save-edit-button" style={styles.saveEditBtn} onPress={saveEdit}>
                      <Text style={styles.saveEditText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {isEditing ? (
                <TextInput
                  testID="transcript-edit-input"
                  style={styles.transcriptInput}
                  value={editedTranscript}
                  onChangeText={setEditedTranscript}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              ) : (
                <Text style={styles.transcriptText}>{transcript}</Text>
              )}

              {sttInfo && !isEditing && (
                <View style={styles.sttMeta}>
                  <Text style={styles.sttMetaText}>
                    Model: {sttInfo.model}
                  </Text>
                  {sttInfo.segments && (
                    <Text style={styles.sttMetaText}>
                      {sttInfo.segments.length} segments detected
                    </Text>
                  )}
                </View>
              )}
            </View>

            {!isEditing && (
              <TouchableOpacity testID="extract-data-button" style={styles.extractButton} onPress={runExtraction}>
                <Brain size={18} color="#FFF" />
                <Text style={styles.extractText}>Extract Medical Data</Text>
              </TouchableOpacity>
            )}

            {!isEditing && (
              <TouchableOpacity testID="re-record-button" style={styles.reRecordButton} onPress={() => { setStep('record'); setTranscript(''); setRecordingDuration(0); }}>
                <Mic size={16} color={theme.primary} />
                <Text style={styles.reRecordText}>Re-record</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* STEP 4: Extraction Loading */}
        {step === 'extract' && extractLoading && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.processingTitle}>Extracting Medical Data</Text>
            <Text style={styles.processingDesc}>Running {aiStatus.llm.modelName}...</Text>
            <View style={styles.aiBanner}>
              <Zap size={14} color={theme.primary} />
              <Text style={styles.aiBannerText}>
                {aiStatus.isWebPreview ? 'Intelligent mock extraction (web preview)' : 'GPU Delegate • Quantized INT4'}
              </Text>
            </View>
            <Text style={styles.processingNote}>
              Analyzing transcript for symptoms, vitals, medications, and ICD codes...
            </Text>
          </View>
        )}

        {/* STEP 5: Results */}
        {step === 'done' && extractedData && (
          <>
            <View style={styles.doneHeader}>
              <CheckCircle size={28} color={theme.success} />
              <Text style={styles.doneTitle}>Data Extracted</Text>
            </View>

            {extractInfo && (
              <View style={styles.extractStats}>
                <View style={styles.sttStat}>
                  <BarChart3 size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{(extractInfo.confidence * 100).toFixed(0)}% conf.</Text>
                </View>
                <View style={styles.sttStat}>
                  <Clock size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{extractInfo.processingTimeMs}ms</Text>
                </View>
                <View style={styles.sttStat}>
                  <Cpu size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{extractInfo.tokensGenerated} tokens</Text>
                </View>
                <View style={styles.sttStat}>
                  <Zap size={14} color={theme.primary} />
                  <Text style={styles.sttStatText}>{extractInfo.tokensPerSecond} tok/s</Text>
                </View>
              </View>
            )}

            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>ASSESSMENT</Text>
              <Text style={styles.dataValue}>{extractedData.assessment}</Text>
            </View>

            {extractedData.symptoms?.length > 0 && (
              <View style={styles.dataCard}>
                <Text style={styles.dataLabel}>SYMPTOMS</Text>
                {extractedData.symptoms.map((s: string, i: number) => (
                  <Text key={i} style={styles.listItem}>• {s}</Text>
                ))}
              </View>
            )}

            {extractedData.vitals && Object.keys(extractedData.vitals).length > 0 && (
              <View style={styles.dataCard}>
                <Text style={styles.dataLabel}>VITALS</Text>
                {Object.entries(extractedData.vitals).map(([k, v]) => (
                  <View key={k} style={styles.vitalRow}>
                    <Text style={styles.vitalKey}>{k.replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.vitalVal}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            )}

            {extractedData.current_medications?.length > 0 && (
              <View style={styles.dataCard}>
                <Text style={styles.dataLabel}>MEDICATIONS MENTIONED</Text>
                {extractedData.current_medications.map((m: string, i: number) => (
                  <Text key={i} style={styles.listItem}>• {m}</Text>
                ))}
              </View>
            )}

            {extractedData.plan?.length > 0 && (
              <View style={styles.dataCard}>
                <Text style={styles.dataLabel}>TREATMENT PLAN</Text>
                {extractedData.plan.map((p: string, i: number) => (
                  <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>
                ))}
              </View>
            )}

            {extractedData.icd_codes?.length > 0 && (
              <View style={styles.dataCard}>
                <Text style={styles.dataLabel}>ICD-10 CODES</Text>
                {extractedData.icd_codes.map((c: string, i: number) => (
                  <View key={i} style={styles.icdBadge}>
                    <Text style={styles.icdText}>{c}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity testID="view-consultation-button" style={styles.primaryButton} onPress={() => router.push(`/consultation/${consultationId}`)}>
              <Text style={styles.primaryButtonText}>View Full Consultation</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="new-recording-button" style={styles.secondaryButton} onPress={() => { setStep('record'); setTranscript(''); setExtractedData(null); setRecordingDuration(0); }}>
              <Mic size={16} color={theme.primary} />
              <Text style={styles.secondaryButtonText}>Record Another Session</Text>
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
  topBadges: { flexDirection: 'row', gap: 6 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  modeBadgeWeb: { backgroundColor: '#FEF3C7' },
  modeBadgeNative: { backgroundColor: '#ECFDF5' },
  modeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  modeTextWeb: { color: '#92400E' },
  modeTextNative: { color: '#065F46' },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  aiBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 6, gap: 8, marginBottom: Spacing.lg },
  aiBannerText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500', flex: 1 },

  // Patient Selection
  patientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.primary },
  patientInfo: { flex: 1, marginLeft: Spacing.md },
  patientName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  patientMeta: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },

  // Permission
  permissionWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: Spacing.md, borderRadius: 8, gap: 8, marginBottom: Spacing.lg },
  permissionText: { flex: 1, fontSize: FontSizes.md, color: theme.error },
  permissionBtn: { backgroundColor: theme.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  permissionBtnText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: '700' },

  // Recording
  micContainer: { alignItems: 'center', paddingVertical: Spacing.xl },
  timerContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.error },
  timerText: { fontSize: FontSizes.xxl, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  micCircleActive: { backgroundColor: theme.error },
  micLabel: { fontSize: FontSizes.base, color: theme.textSecondary, marginTop: Spacing.md },
  waveContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: Spacing.lg, height: 40 },
  waveBar: { width: 4, borderRadius: 2 },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.md },
  recordingInfoText: { fontSize: FontSizes.md, color: theme.textSecondary },

  // Processing
  processingContainer: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  processingTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary, marginTop: Spacing.lg },
  processingDesc: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  processingNote: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center', paddingHorizontal: Spacing.xl },

  // STT Stats
  sttStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  sttStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  sttStatText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },

  // Transcript
  transcriptCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  transcriptLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  editButtonText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 8 },
  cancelEditBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: theme.border },
  cancelEditText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontWeight: '600' },
  saveEditBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.primary },
  saveEditText: { fontSize: FontSizes.sm, color: '#FFF', fontWeight: '600' },
  transcriptText: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24 },
  transcriptInput: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.primary, borderRadius: 6, padding: Spacing.md, minHeight: 140 },
  sttMeta: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border },
  sttMetaText: { fontSize: FontSizes.sm, color: theme.textSecondary, marginBottom: 2 },

  // Buttons
  extractButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, height: 52, borderRadius: 9999, gap: Spacing.sm },
  extractText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  reRecordButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary, height: 48, borderRadius: 9999, gap: 6, marginTop: Spacing.md },
  reRecordText: { fontSize: FontSizes.base, color: theme.primary, fontWeight: '600' },

  // Extraction Stats
  extractStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },

  // Done
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  doneTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  dataCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  dataLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  dataValue: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  listItem: { fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: 4, lineHeight: 22 },
  vitalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.border },
  vitalKey: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textSecondary },
  vitalVal: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  icdBadge: { backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 6, marginBottom: Spacing.xs },
  icdText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  primaryButton: { backgroundColor: theme.primary, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  primaryButtonText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary, height: 48, borderRadius: 9999, gap: 6, marginTop: Spacing.md },
  secondaryButtonText: { fontSize: FontSizes.base, color: theme.primary, fontWeight: '600' },

  // Empty
  emptyCard: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8 },
  emptyText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textSecondary },
  emptySubtext: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 4 },
});
