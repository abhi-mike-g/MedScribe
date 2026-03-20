import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Shield, ChevronLeft, ChevronRight, User, Mail, Lock, Stethoscope, FileText } from 'lucide-react-native';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [license, setLicense] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Name, email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(name, email, password, specialty || 'General Medicine', license);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="register-back-button" onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={20} color={theme.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Shield size={28} color={theme.primary} strokeWidth={2.5} />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join MedScribe — Secure medical workspace</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputWrapper}>
              <User size={18} color={theme.textSecondary} />
              <TextInput testID="register-name-input" style={styles.input} placeholder="Dr. John Smith" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color={theme.textSecondary} />
              <TextInput testID="register-email-input" style={styles.input} placeholder="doctor@clinic.com" placeholderTextColor={theme.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={theme.textSecondary} />
              <TextInput testID="register-password-input" style={styles.input} placeholder="Minimum 6 characters" placeholderTextColor={theme.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SPECIALTY</Text>
            <View style={styles.inputWrapper}>
              <Stethoscope size={18} color={theme.textSecondary} />
              <TextInput testID="register-specialty-input" style={styles.input} placeholder="e.g. General Medicine" placeholderTextColor={theme.textSecondary} value={specialty} onChangeText={setSpecialty} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>LICENSE NUMBER</Text>
            <View style={styles.inputWrapper}>
              <FileText size={18} color={theme.textSecondary} />
              <TextInput testID="register-license-input" style={styles.input} placeholder="Optional" placeholderTextColor={theme.textSecondary} value={license} onChangeText={setLicense} />
            </View>
          </View>

          <TouchableOpacity
            testID="register-submit-button"
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.submitText}>Create Secure Account</Text>
                <ChevronRight size={18} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="goto-login-link" onPress={() => router.push('/(auth)/login')} style={styles.linkButton}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  header: { marginBottom: Spacing.lg },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, marginTop: Spacing.md },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs },
  errorBox: { backgroundColor: theme.errorBg, padding: Spacing.md, borderRadius: 6, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error },
  errorText: { color: theme.error, fontSize: FontSizes.md },
  inputGroup: { marginBottom: Spacing.base },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 52, gap: Spacing.sm },
  input: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary },
  submitButton: { backgroundColor: theme.primary, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  submitButtonDisabled: { opacity: 0.6 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  linkButton: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
  linkText: { fontSize: FontSizes.md, color: theme.textSecondary },
  linkTextBold: { color: theme.primary, fontWeight: '700' },
});
