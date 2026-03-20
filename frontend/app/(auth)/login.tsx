import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Lock, Mail, Shield, ChevronRight } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Shield size={32} color={theme.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.brandName}>MEDSCRIBE</Text>
            <Text style={styles.tagline}>Secure Medical Documentation</Text>
          </View>

          <View style={styles.e2eeBadge}>
            <Lock size={12} color="#10B981" />
            <Text style={styles.e2eeText}>END-TO-END ENCRYPTED</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign In</Text>
            <Text style={styles.formSubtitle}>Access your secure medical workspace</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={theme.textSecondary} />
                <TextInput
                  testID="login-email-input"
                  style={styles.input}
                  placeholder="doctor@clinic.com"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={theme.textSecondary} />
                <TextInput
                  testID="login-password-input"
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.submitText}>Sign In Securely</Text>
                  <ChevronRight size={18} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity testID="goto-register-link" onPress={() => router.push('/(auth)/register')} style={styles.linkButton}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkTextBold}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>HIPAA & GDPR Compliant</Text>
            <Text style={styles.footerSubtext}>All data processed on-device</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  logoContainer: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#E8EEFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  brandName: {
    fontSize: FontSizes.xxl, fontWeight: '800', color: theme.primary,
    letterSpacing: 3,
  },
  tagline: {
    fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs,
  },
  e2eeBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    backgroundColor: '#052E16', paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: 9999, marginBottom: Spacing.lg, gap: 6,
  },
  e2eeText: {
    fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700', letterSpacing: 1.5,
  },
  form: { marginBottom: Spacing.xl },
  formTitle: {
    fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary,
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: FontSizes.base, color: theme.textSecondary, marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  errorBox: {
    backgroundColor: theme.errorBg, padding: Spacing.md, borderRadius: 6,
    marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error,
  },
  errorText: { color: theme.error, fontSize: FontSizes.md },
  inputGroup: { marginBottom: Spacing.base },
  label: {
    fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary,
    letterSpacing: 1.5, marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg,
    borderWidth: 1, borderColor: theme.border, borderRadius: 8,
    paddingHorizontal: Spacing.md, height: 52, gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary },
  submitButton: {
    backgroundColor: theme.primary, height: 52, borderRadius: 9999,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg,
  },
  submitButtonDisabled: { opacity: 0.6 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  linkButton: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
  linkText: { fontSize: FontSizes.md, color: theme.textSecondary },
  linkTextBold: { color: theme.primary, fontWeight: '700' },
  footer: { alignItems: 'center', paddingVertical: Spacing.lg },
  footerText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontWeight: '600' },
  footerSubtext: { fontSize: FontSizes.xs, color: theme.textSecondary, marginTop: 2 },
});
