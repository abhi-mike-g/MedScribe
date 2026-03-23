import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, TextInput, Platform, Alert, KeyboardAvoidingView, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { File as ExpoFile } from 'expo-file-system';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Mic, MicOff, Lock, Cpu, Square, Edit3, Clock, BarChart3, Send, CheckCircle, AlertTriangle, Stethoscope, Pill, Activity, FileText, Brain, Thermometer, ChevronDown, ChevronUp, Globe, Languages, RefreshCw } from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Step = 'ready' | 'recording' | 'uploading' | 'transcribing' | 'extracting' | 'review' | 'submitting' | 'done';

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  whisper_code: string | null;
}

interface MedicalExtraction {
  chief_complaint: string;
  symptoms: { name: string; severity: string; duration: string; notes: string }[];
  medical_history_mentioned: string[];
  medications_mentioned: string[];
  allergies_mentioned: string[];
  vital_signs_mentioned: Record<string, string>;
  suggested_diagnosis: string[];
  recommended_tests: string[];
  urgency_level: string;
  key_quotes: string[];
  summary: string;
}

export default function PatientRecordScreen() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('ready');
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [extraction, setExtraction] = useState<MedicalExtraction | null>(null);
  const [sttInfo, setSttInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [lastAudioUri, setLastAudioUri] = useState<string | null>(null);

  // Language selection
  const [languages, setLanguages] = useState<LanguageOption[]>([
    { code: 'auto', name: 'Auto-detect', flag: '🌐', whisper_code: null },
    { code: 'en', name: 'English', flag: '🇬🇧', whisper_code: 'en' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', whisper_code: 'hi' },
  ]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [whisperModel, setWhisperModel] = useState('base');

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    symptoms: true, diagnosis: true, medications: false, history: false, vitals: false, tests: false, quotes: false
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Fetch supported languages from backend on mount
  useFocusEffect(useCallback(() => {
    fetchLanguages();
    requestMicPermission();
  }, []));

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

  const fetchLanguages = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/languages`);
      if (res.ok) {
        const data = await res.json();
        setLanguages(data.languages);
        setWhisperModel(data.whisper_model || 'base');
      }
    } catch (e) {
      console.warn('Failed to fetch languages, using defaults:', e);
    }
  };

  const requestMicPermission = async () => {
    try {
      if (Platform.OS === 'web') { setPermissionGranted(true); return; }
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          'Microphone Permission Required',
          'MedScribe needs microphone access to record doctor-patient conversations. Please grant permission in Settings.',
          [{ text: 'OK' }]
        );
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    } catch (e) {
      console.warn('Permission request failed:', e);
      setPermissionGranted(true); // Assume granted for web fallback
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedLangInfo = languages.find(l => l.code === selectedLanguage) || languages[0];

  const startRecording = async () => {
    setError('');
    setRetryCount(0);
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setStep('recording');
      setRecordingDuration(0);
      timerRef.current = setInterval(() => { setRecordingDuration(prev => prev + 1); }, 1000);
    } catch (err: any) {
      console.error('Recording start failed:', err);
      if (Platform.OS !== 'web') {
        Alert.alert('Recording Failed', 'Could not start recording. Please ensure microphone permission is granted and try again.');
      }
      setError('Failed to start recording. Check microphone permissions.');
      setStep('ready');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setStep('uploading');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        setLastAudioUri(uri);
        await uploadAndTranscribe(uri);
      } else {
        setError('No audio file produced. Please try recording again.');
        setStep('ready');
      }
    } catch (err: any) {
      console.error('Recording stop failed:', err);
      setError('Failed to stop recording. Please try again.');
      setStep('ready');
    }
  };

  const uploadAndTranscribe = async (audioUri: string, attempt: number = 1) => {
    const MAX_RETRIES = 3;
    setStep('uploading');
    setUploadProgress(0);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // Web: fetch the blob from the recorder URI
        const response = await fetch(audioUri);
        const blob = await response.blob();
        formData.append('audio', blob, 'recording.webm');
      } else {
        // Android/iOS: use the native file URI
        // Verify file exists using new expo-file-system File class (SDK 54+)
        try {
          const filePath = audioUri.startsWith('file://') ? audioUri.replace('file://', '') : audioUri;
          const audioFile = new ExpoFile(filePath);
          if (!audioFile.exists) {
            throw new Error('Audio file not found on device');
          }
        } catch (fileCheckError: any) {
          // If file check fails, log but proceed anyway - the recorder just created this file
          console.warn('File existence check warning (proceeding with upload):', fileCheckError?.message);
        }
        // Determine file extension from URI
        const extension = audioUri.split('.').pop() || 'm4a';
        const mimeType = extension === 'webm' ? 'audio/webm' :
                         extension === 'wav' ? 'audio/wav' :
                         extension === 'mp3' ? 'audio/mpeg' :
                         extension === 'caf' ? 'audio/x-caf' :
                         'audio/m4a';
        formData.append('audio', {
          uri: audioUri,
          type: mimeType,
          name: `recording.${extension}`,
        } as any);
      }

      // Add language selection
      formData.append('language', selectedLanguage);

      setStep('transcribing');
      setUploadProgress(50);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout for mobile

      const res = await fetch(`${BACKEND_URL}/api/audio/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      setUploadProgress(80);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Server error' }));
        throw new Error(errData.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setUploadProgress(100);
      setTranscript(data.transcript || '');
      setEditedTranscript(data.transcript || '');
      setSttInfo(data.stt);

      if (data.extraction) {
        setExtraction(data.extraction);
        setChiefComplaint(data.extraction.chief_complaint || '');
        setStep('review');
      } else if (data.transcript) {
        setStep('extracting');
        await runExtraction(data.transcript, data.stt?.language || selectedLanguage);
      } else {
        setError('No speech detected. Please speak clearly and try again.');
        setStep('ready');
      }
    } catch (e: any) {
      console.error(`Upload attempt ${attempt} failed:`, e);

      if (e.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          setRetryCount(attempt);
          setError(`Upload timed out. Retrying (${attempt}/${MAX_RETRIES})...`);
          await uploadAndTranscribe(audioUri, attempt + 1);
          return;
        }
        setError('Upload timed out after multiple attempts. Please check your internet connection and try again.');
      } else if (attempt < MAX_RETRIES && (e.message?.includes('Network') || e.message?.includes('fetch'))) {
        setRetryCount(attempt);
        setError(`Network error. Retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
        await uploadAndTranscribe(audioUri, attempt + 1);
        return;
      } else {
        setError(e.message || 'Failed to transcribe. Please try again.');
      }
      setStep('ready');
    }
  };

  const retryUpload = () => {
    if (lastAudioUri) {
      uploadAndTranscribe(lastAudioUri);
    }
  };

  const runExtraction = async (text: string, lang: string = 'en') => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/audio/extract-from-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ transcript: text, language: lang }),
      });
      if (res.ok) {
        const data = await res.json();
        setExtraction(data.extraction);
        setChiefComplaint(data.extraction?.chief_complaint || '');
      }
      setStep('review');
    } catch (e) {
      console.error('Extraction failed:', e);
      setStep('review');
    }
  };

  const startEditing = () => { setIsEditing(true); setEditedTranscript(transcript); };
  const saveEdit = async () => {
    setTranscript(editedTranscript);
    setIsEditing(false);
    if (editedTranscript !== transcript) {
      setStep('extracting');
      await runExtraction(editedTranscript, sttInfo?.language || selectedLanguage);
    }
  };
  const cancelEdit = () => { setEditedTranscript(transcript); setIsEditing(false); };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const submitCase = async () => {
    if (!transcript.trim()) { setError('Transcript cannot be empty'); return; }
    setStep('submitting');
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/cases/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          transcript,
          chief_complaint: chiefComplaint || extraction?.chief_complaint || transcript.substring(0, 100),
          extraction_data: extraction,
        }),
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
    setExtraction(null);
    setSttInfo(null);
    setRecordingDuration(0);
    setError('');
    setUploadProgress(0);
    setRetryCount(0);
    setLastAudioUri(null);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return { bg: '#FEE2E2', text: '#991B1B', icon: '#DC2626' };
      case 'high': return { bg: '#FEF3C7', text: '#92400E', icon: '#F59E0B' };
      case 'medium': return { bg: '#E8EEFF', text: '#0033A0', icon: '#0033A0' };
      default: return { bg: '#ECFDF5', text: '#065F46', icon: '#10B981' };
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'severe': return '#DC2626';
      case 'moderate': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const SectionHeader = ({ title, icon, sectionKey, count }: { title: string; icon: React.ReactNode; sectionKey: string; count?: number }) => (
    <TouchableOpacity style={st.sectionHeader} onPress={() => toggleSection(sectionKey)} activeOpacity={0.7}>
      <View style={st.sectionLeft}>
        {icon}
        <Text style={st.sectionTitle}>{title}</Text>
        {count !== undefined && count > 0 && <View style={st.countBadge}><Text style={st.countText}>{count}</Text></View>}
      </View>
      {expandedSections[sectionKey] ? <ChevronUp size={16} color={theme.textSecondary} /> : <ChevronDown size={16} color={theme.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.flex}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={st.headerRow}>
            <Text style={st.title}>Record Case</Text>
            <View style={st.badges}>
              <View style={st.e2eeBadge}><Lock size={10} color="#10B981" /><Text style={st.e2eeText}>E2EE</Text></View>
              <View style={st.aiBadge}><Brain size={10} color="#0033A0" /><Text style={st.aiText}>AI</Text></View>
            </View>
          </View>

          <View style={st.aiBanner}>
            <Cpu size={14} color={theme.primary} />
            <Text style={st.aiBannerText}>STT: Whisper-{whisperModel} • LLM: GPT-4.1-mini</Text>
          </View>

          {/* Language Selector */}
          <TouchableOpacity style={st.languageSelector} onPress={() => setShowLanguagePicker(true)} activeOpacity={0.7}>
            <Languages size={16} color={theme.primary} />
            <Text style={st.langText}>{selectedLangInfo.flag}  {selectedLangInfo.name}</Text>
            <ChevronDown size={14} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Language Picker Modal */}
          <Modal visible={showLanguagePicker} transparent animationType="slide">
            <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowLanguagePicker(false)}>
              <View style={st.modalContent}>
                <Text style={st.modalTitle}>Select Language</Text>
                <Text style={st.modalDesc}>Choose the language of the conversation. Auto-detect works for most cases.</Text>
                <FlatList
                  data={languages}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[st.langOption, selectedLanguage === item.code && st.langOptionActive]}
                      onPress={() => { setSelectedLanguage(item.code); setShowLanguagePicker(false); }}
                    >
                      <Text style={st.langFlag}>{item.flag}</Text>
                      <View style={st.langInfo}>
                        <Text style={[st.langName, selectedLanguage === item.code && st.langNameActive]}>{item.name}</Text>
                        <Text style={st.langCode}>{item.code === 'auto' ? 'Whisper auto-detects' : `Code: ${item.code}`}</Text>
                      </View>
                      {selectedLanguage === item.code && <CheckCircle size={18} color={theme.primary} />}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

          {error ? (
            <View style={st.errBox}>
              <AlertTriangle size={16} color={theme.error} />
              <Text style={st.errText}>{error}</Text>
              {lastAudioUri && step === 'ready' && (
                <TouchableOpacity style={st.retryBtn} onPress={retryUpload}>
                  <RefreshCw size={14} color="#FFF" />
                  <Text style={st.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* READY STATE */}
          {step === 'ready' && (
            <View style={st.readyContainer}>
              <Text style={st.subtitle}>Record a doctor-patient conversation. The AI will transcribe and extract structured medical data automatically.</Text>

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

              <View style={st.pipelineInfo}>
                <Text style={st.pipelineTitle}>Processing Pipeline</Text>
                <View style={st.pipelineStep}><View style={st.pipeDot} /><Text style={st.pipeText}>Record audio from microphone</Text></View>
                <View style={st.pipelineStep}><View style={st.pipeDot} /><Text style={st.pipeText}>Upload & transcribe with Whisper AI ({selectedLangInfo.name})</Text></View>
                <View style={st.pipelineStep}><View style={st.pipeDot} /><Text style={st.pipeText}>LLM extracts symptoms, diagnosis & more</Text></View>
                <View style={st.pipelineStep}><View style={st.pipeDot} /><Text style={st.pipeText}>Review, edit & submit to doctor</Text></View>
              </View>
            </View>
          )}

          {/* RECORDING STATE */}
          {step === 'recording' && (
            <View style={st.recordingContainer}>
              <View style={st.timerRow}>
                <View style={st.liveDot} />
                <Text style={st.timerText}>{formatDuration(recordingDuration)}</Text>
              </View>
              <Text style={st.langRecording}>{selectedLangInfo.flag} {selectedLangInfo.name}</Text>
              <TouchableOpacity onPress={stopRecording} activeOpacity={0.7}>
                <Animated.View style={[st.micCircleActive, { transform: [{ scale: pulseAnim }] }]}>
                  <Square size={28} color="#FFF" fill="#FFF" />
                </Animated.View>
              </TouchableOpacity>
              <Text style={st.micLabel}>Tap to stop recording</Text>
              <View style={st.waveContainer}>
                {[...Array(16)].map((_, i) => (
                  <View key={i} style={[st.waveBar, { height: 8 + Math.random() * 32, opacity: 0.4 + Math.random() * 0.6 }]} />
                ))}
              </View>
            </View>
          )}

          {/* UPLOADING STATE */}
          {step === 'uploading' && (
            <View style={st.processingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={st.processingTitle}>Uploading Audio...</Text>
              <Text style={st.processingDesc}>Sending recording to server{retryCount > 0 ? ` (attempt ${retryCount + 1})` : ''}</Text>
              <View style={st.progressBar}><View style={[st.progressFill, { width: `${uploadProgress}%` }]} /></View>
            </View>
          )}

          {/* TRANSCRIBING STATE */}
          {step === 'transcribing' && (
            <View style={st.processingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={st.processingTitle}>Transcribing with Whisper...</Text>
              <Text style={st.processingDesc}>{selectedLangInfo.flag} {selectedLangInfo.code === 'auto' ? 'Auto-detecting language' : selectedLangInfo.name}</Text>
              <View style={st.processingSteps}>
                <Text style={st.procStep}>✓ Audio uploaded</Text>
                <Text style={[st.procStep, st.procActive]}>⟳ Running Whisper STT ({whisperModel})...</Text>
                <Text style={st.procPending}>○ LLM medical extraction</Text>
              </View>
            </View>
          )}

          {/* EXTRACTING STATE */}
          {step === 'extracting' && (
            <View style={st.processingContainer}>
              <ActivityIndicator size="large" color="#0033A0" />
              <Text style={st.processingTitle}>Analyzing Transcript...</Text>
              <Text style={st.processingDesc}>LLM extracting medical information</Text>
              <View style={st.processingSteps}>
                <Text style={st.procStep}>✓ Audio transcribed</Text>
                <Text style={[st.procStep, st.procActive]}>⟳ Extracting symptoms, diagnosis...</Text>
              </View>
            </View>
          )}

          {/* REVIEW STATE */}
          {step === 'review' && (
            <>
              {/* STT Stats */}
              {sttInfo && (
                <View style={st.sttStats}>
                  {sttInfo.language_name ? (
                    <View style={st.sttStat}>
                      <Globe size={14} color={theme.primary} />
                      <Text style={st.sttStatText}>{sttInfo.language_name}</Text>
                    </View>
                  ) : null}
                  {sttInfo.confidence ? <View style={st.sttStat}><BarChart3 size={14} color={theme.primary} /><Text style={st.sttStatText}>{(sttInfo.confidence * 100).toFixed(0)}% conf.</Text></View> : null}
                  {sttInfo.duration_seconds ? <View style={st.sttStat}><Clock size={14} color={theme.primary} /><Text style={st.sttStatText}>{sttInfo.duration_seconds}s audio</Text></View> : null}
                  <View style={st.sttStat}><Cpu size={14} color={theme.primary} /><Text style={st.sttStatText}>{sttInfo.model || `whisper-${whisperModel}`}</Text></View>
                </View>
              )}

              {/* Urgency Badge */}
              {extraction?.urgency_level && (
                <View style={[st.urgencyBanner, { backgroundColor: getUrgencyColor(extraction.urgency_level).bg }]}>
                  <AlertTriangle size={16} color={getUrgencyColor(extraction.urgency_level).icon} />
                  <Text style={[st.urgencyText, { color: getUrgencyColor(extraction.urgency_level).text }]}>
                    Urgency: {extraction.urgency_level.toUpperCase()}
                  </Text>
                </View>
              )}

              {/* Summary */}
              {extraction?.summary && (
                <View style={st.summaryCard}>
                  <Text style={st.summaryLabel}>AI CLINICAL SUMMARY</Text>
                  <Text style={st.summaryText}>{extraction.summary}</Text>
                </View>
              )}

              {/* Transcript Card */}
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
                      <TouchableOpacity style={st.saveBtn} onPress={saveEdit}><Text style={st.saveText}>Save & Re-analyze</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
                {isEditing ? (
                  <TextInput style={st.transcriptInput} value={editedTranscript} onChangeText={setEditedTranscript} multiline autoFocus textAlignVertical="top" />
                ) : (
                  <Text style={st.transcriptText}>{transcript}</Text>
                )}
              </View>

              {/* Medical Extraction Results */}
              {extraction && (
                <View style={st.extractionContainer}>
                  <Text style={st.extractionTitle}>AI Medical Extraction</Text>

                  {/* Symptoms */}
                  {extraction.symptoms?.length > 0 && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Symptoms" icon={<Activity size={16} color="#DC2626" />} sectionKey="symptoms" count={extraction.symptoms.length} />
                      {expandedSections.symptoms && extraction.symptoms.map((s, i) => (
                        <View key={i} style={st.symptomRow}>
                          <View style={st.symptomHeader}>
                            <Text style={st.symptomName}>{s.name}</Text>
                            <View style={[st.severityBadge, { backgroundColor: getSeverityColor(s.severity) + '20' }]}>
                              <Text style={[st.severityText, { color: getSeverityColor(s.severity) }]}>{s.severity}</Text>
                            </View>
                          </View>
                          {s.duration ? <Text style={st.symptomMeta}>Duration: {s.duration}</Text> : null}
                          {s.notes ? <Text style={st.symptomMeta}>{s.notes}</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Suggested Diagnosis */}
                  {extraction.suggested_diagnosis?.length > 0 && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Suggested Diagnoses" icon={<Stethoscope size={16} color="#0033A0" />} sectionKey="diagnosis" count={extraction.suggested_diagnosis.length} />
                      {expandedSections.diagnosis && extraction.suggested_diagnosis.map((d, i) => (
                        <View key={i} style={st.listItem}><Text style={st.listText}>• {d}</Text></View>
                      ))}
                    </View>
                  )}

                  {/* Medications Mentioned */}
                  {extraction.medications_mentioned?.length > 0 && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Medications Mentioned" icon={<Pill size={16} color="#7C3AED" />} sectionKey="medications" count={extraction.medications_mentioned.length} />
                      {expandedSections.medications && extraction.medications_mentioned.map((m, i) => (
                        <View key={i} style={st.listItem}><Text style={st.listText}>• {m}</Text></View>
                      ))}
                    </View>
                  )}

                  {/* Medical History */}
                  {extraction.medical_history_mentioned?.length > 0 && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Medical History" icon={<FileText size={16} color="#059669" />} sectionKey="history" count={extraction.medical_history_mentioned.length} />
                      {expandedSections.history && extraction.medical_history_mentioned.map((h, i) => (
                        <View key={i} style={st.listItem}><Text style={st.listText}>• {h}</Text></View>
                      ))}
                    </View>
                  )}

                  {/* Vital Signs */}
                  {extraction.vital_signs_mentioned && Object.values(extraction.vital_signs_mentioned).some(v => v) && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Vital Signs" icon={<Thermometer size={16} color="#EA580C" />} sectionKey="vitals" />
                      {expandedSections.vitals && Object.entries(extraction.vital_signs_mentioned).map(([k, v]) => (
                        v ? <View key={k} style={st.vitalRow}><Text style={st.vitalKey}>{k}:</Text><Text style={st.vitalVal}>{v}</Text></View> : null
                      ))}
                    </View>
                  )}

                  {/* Recommended Tests */}
                  {extraction.recommended_tests?.length > 0 && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Recommended Tests" icon={<FileText size={16} color="#0284C7" />} sectionKey="tests" count={extraction.recommended_tests.length} />
                      {expandedSections.tests && extraction.recommended_tests.map((t, i) => (
                        <View key={i} style={st.listItem}><Text style={st.listText}>• {t}</Text></View>
                      ))}
                    </View>
                  )}

                  {/* Key Quotes */}
                  {extraction.key_quotes?.length > 0 && (
                    <View style={st.sectionCard}>
                      <SectionHeader title="Key Quotes" icon={<FileText size={16} color="#6B7280" />} sectionKey="quotes" count={extraction.key_quotes.length} />
                      {expandedSections.quotes && extraction.key_quotes.map((q, i) => (
                        <View key={i} style={st.quoteItem}><Text style={st.quoteText}>"{q}"</Text></View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Chief Complaint (editable) */}
              <View style={st.inputGroup}>
                <Text style={st.fieldLabel}>CHIEF COMPLAINT</Text>
                <TextInput
                  style={st.input}
                  value={chiefComplaint}
                  onChangeText={setChiefComplaint}
                  placeholder="Brief summary of the primary issue"
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
              <Text style={st.doneDesc}>Your case has been submitted with the AI-extracted medical data. You'll be notified when the doctor responds.</Text>
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
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, gap: 4 },
  aiText: { fontSize: FontSizes.xs, color: '#0033A0', fontWeight: '700' },
  aiBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 6, gap: 8, marginBottom: Spacing.sm },
  aiBannerText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500' },
  languageSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8, marginBottom: Spacing.lg },
  langText: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '60%' },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  modalDesc: { fontSize: FontSizes.sm, color: theme.textSecondary, marginBottom: Spacing.lg },
  langOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: 10, marginBottom: Spacing.sm, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  langOptionActive: { borderColor: theme.primary, backgroundColor: '#E8EEFF' },
  langFlag: { fontSize: 24, marginRight: Spacing.md },
  langInfo: { flex: 1 },
  langName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  langNameActive: { color: theme.primary },
  langCode: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: Spacing.md, borderRadius: 6, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error, gap: 8, flexWrap: 'wrap' },
  errText: { color: theme.error, fontSize: FontSizes.md, flex: 1 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  retryText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: '600' },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  readyContainer: { alignItems: 'center', paddingVertical: Spacing.md },
  bigMicBtn: { marginTop: Spacing.lg },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  micLabel: { fontSize: FontSizes.base, color: theme.textSecondary, marginTop: Spacing.md },
  permWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: Spacing.md, borderRadius: 8, gap: 8, marginBottom: Spacing.lg, width: '100%' },
  permText: { flex: 1, fontSize: FontSizes.md, color: theme.error },
  permBtn: { backgroundColor: theme.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  permBtnText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: '700' },
  pipelineInfo: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, marginTop: Spacing.xl, width: '100%' },
  pipelineTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1, marginBottom: Spacing.md },
  pipelineStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  pipeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  pipeText: { fontSize: FontSizes.sm, color: theme.textPrimary },
  recordingContainer: { alignItems: 'center', paddingVertical: Spacing.xl },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.error },
  timerText: { fontSize: FontSizes.xxl, fontWeight: '700', color: theme.textPrimary, fontVariant: ['tabular-nums'] },
  langRecording: { fontSize: FontSizes.md, color: theme.textSecondary, marginBottom: Spacing.lg },
  micCircleActive: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.error, alignItems: 'center', justifyContent: 'center' },
  waveContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: Spacing.lg, height: 40 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: '#10B981' },
  processingContainer: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  processingTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary, marginTop: Spacing.lg },
  processingDesc: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.sm },
  progressBar: { width: '80%', height: 4, backgroundColor: theme.border, borderRadius: 2, marginTop: Spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 2 },
  processingSteps: { marginTop: Spacing.lg, alignItems: 'flex-start' },
  procStep: { fontSize: FontSizes.md, color: '#10B981', marginBottom: 4 },
  procActive: { color: theme.primary, fontWeight: '600' },
  procPending: { fontSize: FontSizes.md, color: theme.textSecondary, marginBottom: 4 },
  sttStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  sttStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  sttStatText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  urgencyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: 8, marginBottom: Spacing.md },
  urgencyText: { fontSize: FontSizes.base, fontWeight: '700' },
  summaryCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.md },
  summaryLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: '#065F46', letterSpacing: 1.5, marginBottom: Spacing.sm },
  summaryText: { fontSize: FontSizes.base, color: '#065F46', lineHeight: 22 },
  transcriptCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
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
  extractionContainer: { marginBottom: Spacing.lg },
  extractionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary, marginBottom: Spacing.md },
  sectionCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginBottom: Spacing.sm, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  countBadge: { backgroundColor: theme.primary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: FontSizes.xs, color: '#FFF', fontWeight: '700' },
  symptomRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border },
  symptomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symptomName: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  severityText: { fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  symptomMeta: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  listItem: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border },
  listText: { fontSize: FontSizes.md, color: theme.textPrimary },
  vitalRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border },
  vitalKey: { fontSize: FontSizes.md, color: theme.textSecondary, fontWeight: '600', textTransform: 'capitalize', width: 130 },
  vitalVal: { fontSize: FontSizes.md, color: theme.textPrimary, flex: 1 },
  quoteItem: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border },
  quoteText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontStyle: 'italic', lineHeight: 20 },
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
