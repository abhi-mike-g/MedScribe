import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, TextInput, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { transcribeAudio, getNativeAIStatus } from '../../src/native/NativeAIProvider';
import { Mic, MicOff, Lock, Cpu, Square, Edit3, Globe, Smartphone, Clock, BarChart3, Send, CheckCircle } from 'lucide-react-native';

type Step = 'ready' | 'recording' | 'processing' | 'review' | 'submitting' | 'done';

export default function PatientRecordScreen() {
  const { user, authFetch } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('ready');
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [sttInfo, setSttInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const [aiStatus] = useState(() => getNativeAIStatus());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => { requestMicPermission(); }, []);

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
      if (Platform.OS === 'web') { setPermissionGranted(true); return; }
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (!granted) Alert.alert('Microphone Permission', 'Microphone access is required for recording. Please enable it in Settings.');
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    } catch (e) {
      console.warn('Permission request failed:', e);
      setPermissionGranted(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setError('');
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setStep('recording');
      setRecordingDuration(0);
      timerRef.current = setInterval(() => { setRecordingDuration(prev => prev + 1); }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setRecording(true);
      setStep('recording');
      setRecordingDuration(0);
      timerRef.current = setInterval(() => { setRecordingDuration(prev => prev + 1); }, 1000);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setStep('processing');
    const durationMs = recordingDuration * 1000;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      processAudio(uri || 'web-recording-mock', durationMs);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      processAudio('fallback-recording', durationMs);
    }
  };

  const processAudio = async (uri: string, durationMs: number) => {
    try {
      const result = await transcribeAudio(uri, durationMs);
      setTranscript(result.transcript);
      setEditedTranscript(result.transcript);
      setSttInfo(result);
      setStep('review');
    } catch (e) {
      console.error('STT processing failed:', e);
      setError('Failed to transcribe audio. Please try again.');
      setStep('ready');
    }
  };

  const startEditing = () => { setIsEditing(true); setEditedTranscript(transcript); };
  const saveEdit = () => { setTranscript(editedTranscript); setIsEditing(false); };
  const cancelEdit = () => { setEditedTranscript(transcript); setIsEditing(false); };

  const submitCase = async () => {
    if (!transcript.trim()) { setError('Transcript cannot be empty'); return; }
    setStep('submitting');
    setError('');
    try {
      const res = await authFetch('/api/cases/submit', {
        method: 'POST',
        body: JSON.stringify({ transcript, chief_complaint: chiefComplaint || transcript.substring(0, 100) }),
      });
      if (res.ok) {
        setStep('done');
      } else {
        const e = await res.json();
        setError(e.detail || 'Submission failed');
        setStep('review');
      }
    } catch (e) {
      setError('Network error. Please try again.');
      setStep('review');
    }
  };

  const resetForm = () => {
    setStep('ready');
    setTranscript('');
    setEditedTranscript('');
    setChiefComplaint('');
    setSttInfo(null);
    setRecordingDuration(0);
    setError('');
  };

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.flex}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={st.headerRow}>
            <Text style={st.title}>Record Case</Text>
            <View style={st.badges}>
              <View style={st.e2eeBadge}><Lock size={10} color="#10B981" /><Text style={st.e2eeText}>E2EE</Text></View>
              <View style={[st.modeBadge, aiStatus.isWebPreview ? st.modeBadgeWeb : st.modeBadgeNative]}>
                {aiStatus.isWebPreview ? <Globe size={10} color="#92400E" /> : <Smartphone size={10} color="#065F46" />}
                <Text style={[st.modeText, aiStatus.isWebPreview ? st.modeTextWeb : st.modeTextNative]}>
                  {aiStatus.isWebPreview ? 'MOCK' : 'DEVICE'}
                </Text>
              </View>
            </View>
          </View>

          <View style={st.aiBanner}>
            <Cpu size={14} color={theme.primary} />
            <Text style={st.aiBannerText}>STT: {aiStatus.stt.modelName}</Text>
          </View>

          {error ? <View style={st.errBox}><Text style={st.errText}>{error}</Text></View> : null}

          {/* READY STATE */}
          {step === 'ready' && (
            <View style={st.readyContainer}>
              <Text style={st.subtitle}>Describe your symptoms by speaking into the microphone. Your recording will be transcribed and you can edit it before submitting.</Text>

              {!permissionGranted && Platform.OS !== 'web' && (
                <View style={st.permWarn}>
                  <MicOff size={16} color={theme.error} />
                  <Text style={st.permText}>Microphone permission required</Text>
                  <TouchableOpacity style={st.permBtn} onPress={requestMicPermission}>
                    <Text style={st.permBtnText}>Grant</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={st.bigMicBtn} onPress={startRecording} activeOpacity={0.7}>
                <View style={st.micCircle}><Mic size={36} color="#10B981" /></View>
              </TouchableOpacity>
              <Text style={st.micLabel}>Tap to start recording</Text>
            </View>
          )}

          {/* RECORDING STATE */}
          {step === 'recording' && (
            <View style={st.recordingContainer}>
              <View style={st.timerRow}>
                <View style={st.liveDot} />
                <Text style={st.timerText}>{formatDuration(recordingDuration)}</Text>
              </View>

              <TouchableOpacity onPress={stopRecording} activeOpacity={0.7}>
                <Animated.View style={[st.micCircleActive, { transform: [{ scale: pulseAnim }] }]}>
                  <Square size={28} color="#FFF" fill="#FFF" />
                </Animated.View>
              </TouchableOpacity>
              <Text style={st.micLabel}>Tap to stop recording</Text>

              <View style={st.waveContainer}>
                {[...Array(12)].map((_, i) => (
                  <View key={i} style={[st.waveBar, { height: 8 + Math.random() * 28, opacity: 0.4 + Math.random() * 0.6 }]} />
                ))}
              </View>
            </View>
          )}

          {/* PROCESSING STATE */}
          {step === 'processing' && (
            <View style={st.processingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={st.processingTitle}>Transcribing Audio...</Text>
              <Text style={st.processingDesc}>Running {aiStatus.stt.modelName}</Text>
            </View>
          )}

          {/* REVIEW STATE */}
          {step === 'review' && (
            <>
              {sttInfo && (
                <View style={st.sttStats}>
                  <View style={st.sttStat}><BarChart3 size={14} color={theme.primary} /><Text style={st.sttStatText}>{(sttInfo.confidence * 100).toFixed(0)}% conf.</Text></View>
                  <View style={st.sttStat}><Clock size={14} color={theme.primary} /><Text style={st.sttStatText}>{sttInfo.processingTimeMs}ms</Text></View>
                  <View style={st.sttStat}><Cpu size={14} color={theme.primary} /><Text style={st.sttStatText}>{sttInfo.isOnDevice ? 'On-Device' : 'Mock'}</Text></View>
                </View>
              )}

              <View style={st.transcriptCard}>
                <View style={st.transcriptHeader}>
                  <Text style={st.transcriptLabel}>TRANSCRIPT</Text>
                  {!isEditing ? (
                    <TouchableOpacity style={st.editButton} onPress={startEditing}>
                      <Edit3 size={14} color={theme.primary} /><Text style={st.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={st.editActions}>
                      <TouchableOpacity style={st.cancelBtn} onPress={cancelEdit}><Text style={st.cancelText}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity style={st.saveBtn} onPress={saveEdit}><Text style={st.saveText}>Save</Text></TouchableOpacity>
                    </View>
                  )}
                </View>

                {isEditing ? (
                  <TextInput style={st.transcriptInput} value={editedTranscript} onChangeText={setEditedTranscript} multiline autoFocus textAlignVertical="top" />
                ) : (
                  <Text style={st.transcriptText}>{transcript}</Text>
                )}
              </View>

              <View style={st.inputGroup}>
                <Text style={st.fieldLabel}>CHIEF COMPLAINT (SUMMARY)</Text>
                <TextInput
                  style={st.input}
                  value={chiefComplaint}
                  onChangeText={setChiefComplaint}
                  placeholder="Brief summary of your issue"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {!isEditing && (
                <>
                  <TouchableOpacity style={st.submitBtn} onPress={submitCase} activeOpacity={0.8}>
                    <Send size={18} color="#FFF" />
                    <Text style={st.submitBtnText}>Submit to Doctor</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={st.reRecordBtn} onPress={resetForm}>
                    <Mic size={16} color="#10B981" />
                    <Text style={st.reRecordText}>Re-record</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* SUBMITTING STATE */}
          {step === 'submitting' && (
            <View style={st.processingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={st.processingTitle}>Submitting Case...</Text>
              <Text style={st.processingDesc}>Encrypting and sending to doctor</Text>
            </View>
          )}

          {/* DONE STATE */}
          {step === 'done' && (
            <View style={st.doneContainer}>
              <CheckCircle size={48} color="#10B981" />
              <Text style={st.doneTitle}>Case Submitted!</Text>
              <Text style={st.doneDesc}>Your case has been encrypted and submitted. You will be notified when the doctor responds.</Text>
              <TouchableOpacity style={st.viewCasesBtn} onPress={() => router.push('/(patient-tabs)/cases')}>
                <Text style={st.viewCasesBtnText}>View My Cases</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.newCaseBtn} onPress={resetForm}>
                <Mic size={16} color="#10B981" />
                <Text style={st.newCaseText}>Record Another Case</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  badges: { flexDirection: 'row', gap: 6 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#052E16', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  modeBadgeWeb: { backgroundColor: '#FEF3C7' },
  modeBadgeNative: { backgroundColor: '#ECFDF5' },
  modeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  modeTextWeb: { color: '#92400E' },
  modeTextNative: { color: '#065F46' },
  aiBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 6, gap: 8, marginBottom: Spacing.lg },
  aiBannerText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500' },
  errBox: { backgroundColor: theme.errorBg, padding: Spacing.md, borderRadius: 6, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error },
  errText: { color: theme.error, fontSize: FontSizes.md },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  readyContainer: { alignItems: 'center', paddingVertical: Spacing.xl },
  bigMicBtn: { marginTop: Spacing.lg },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  micLabel: { fontSize: FontSizes.base, color: theme.textSecondary, marginTop: Spacing.md },
  permWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: Spacing.md, borderRadius: 8, gap: 8, marginBottom: Spacing.lg, width: '100%' },
  permText: { flex: 1, fontSize: FontSizes.md, color: theme.error },
  permBtn: { backgroundColor: theme.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  permBtnText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: '700' },
  recordingContainer: { alignItems: 'center', paddingVertical: Spacing.xl },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.error },
  timerText: { fontSize: FontSizes.xxl, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  micCircleActive: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.error, alignItems: 'center', justifyContent: 'center' },
  waveContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: Spacing.lg, height: 40 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: '#10B981' },
  processingContainer: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  processingTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary, marginTop: Spacing.lg },
  processingDesc: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.sm },
  sttStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  sttStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  sttStatText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  transcriptCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.lg },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  transcriptLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  editButtonText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: theme.border },
  cancelText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.primary },
  saveText: { fontSize: FontSizes.sm, color: '#FFF', fontWeight: '600' },
  transcriptText: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24 },
  transcriptInput: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.primary, borderRadius: 6, padding: Spacing.md, minHeight: 140 },
  inputGroup: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  input: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSizes.base, color: theme.textPrimary },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', height: 52, borderRadius: 9999, gap: Spacing.sm },
  submitBtnText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  reRecordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#10B981', height: 48, borderRadius: 9999, gap: 6, marginTop: Spacing.md },
  reRecordText: { fontSize: FontSizes.base, color: '#10B981', fontWeight: '600' },
  doneContainer: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  doneTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, marginTop: Spacing.lg },
  doneDesc: { fontSize: FontSizes.md, color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22, paddingHorizontal: Spacing.lg },
  viewCasesBtn: { backgroundColor: '#10B981', height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, width: '100%' },
  viewCasesBtnText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  newCaseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#10B981', height: 48, borderRadius: 9999, gap: 6, marginTop: Spacing.md, width: '100%' },
  newCaseText: { fontSize: FontSizes.base, color: '#10B981', fontWeight: '600' },
});
