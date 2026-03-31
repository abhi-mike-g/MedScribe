import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, UserRole } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Lock, Mail, Shield, ChevronRight, Stethoscope, User, ShieldCheck } from 'lucide-react-native';

const ROLES: { key: UserRole; label: string; icon: any; color: string }[] = [
  { key: 'doctor', label: 'Doctor', icon: Stethoscope, color: '#0033A0' },
  { key: 'patient', label: 'Patient', icon: User, color: '#10B981' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, color: '#7A8BFF' },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('doctor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      await login(email, password, role);
      // Navigate immediately — PIN setup modal will overlay the dashboard if needed
      const targets: Record<string, string> = {
        doctor: '/(doctor-tabs)/dashboard',
        patient: '/(patient-tabs)/home',
        admin: '/(admin-tabs)/overview',
      };
      router.replace(targets[role] || '/');
    } catch (e: any) { setError(e.message || 'Login failed'); setLoading(false); }

  };

  const selectedRole = ROLES.find(r => r.key === role)!;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoBox}><Shield size={32} color={theme.primary} strokeWidth={2.5} /></View>
            <Text style={styles.brand}>MEDSCRIBE</Text>
            <Text style={styles.tagline}>Secure Medical Documentation</Text>
          </View>

          <View style={styles.e2ee}>
            <Lock size={12} color="#10B981" />
            <Text style={styles.e2eeText}>END-TO-END ENCRYPTED</Text>
          </View>

          <Text style={styles.roleLabel}>SELECT YOUR ROLE</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => {
              const Icon = r.icon;
              const active = role === r.key;
              return (
                <TouchableOpacity
                  testID={`role-${r.key}`} key={r.key}
                  style={[styles.roleCard, active && { borderColor: r.color, backgroundColor: r.color + '10' }]}
                  onPress={() => setRole(r.key)}
                >
                  <Icon size={22} color={active ? r.color : theme.textSecondary} />
                  <Text style={[styles.roleText, active && { color: r.color, fontWeight: '700' }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.form}>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrap}>
                <Mail size={18} color={theme.textSecondary} />
                <TextInput testID="login-email-input" style={styles.input} placeholder={`${selectedRole.label.toLowerCase()}@clinic.com`} placeholderTextColor={theme.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Lock size={18} color={theme.textSecondary} />
                <TextInput testID="login-password-input" style={styles.input} placeholder="Enter password" placeholderTextColor={theme.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />
              </View>
            </View>

            <TouchableOpacity testID="login-submit-button" style={[styles.submit, { backgroundColor: selectedRole.color }, loading && styles.submitDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <View style={styles.btnRow}><Text style={styles.submitText}>Sign In as {selectedRole.label}</Text><ChevronRight size={18} color="#FFF" /></View>
              )}
            </TouchableOpacity>

            <TouchableOpacity testID="goto-register-link" onPress={() => router.push('/(auth)/register')} style={styles.link}>
              <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>HIPAA & GDPR Compliant • Principle of Least Privilege</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  logoBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  brand: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.primary, letterSpacing: 3 },
  tagline: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs },
  e2ee: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: '#052E16', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 9999, marginBottom: Spacing.lg, gap: 6 },
  e2eeText: { fontSize: FontSizes.xs, color: '#10B981', fontWeight: '700', letterSpacing: 1.5 },
  roleLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm, textAlign: 'center' },
  roleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  roleCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: 8, borderWidth: 2, borderColor: theme.border, gap: 6 },
  roleText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontWeight: '500' },
  form: { marginBottom: Spacing.xl },
  errorBox: { backgroundColor: theme.errorBg, padding: Spacing.md, borderRadius: 6, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error },
  errorText: { color: theme.error, fontSize: FontSizes.md },
  inputGroup: { marginBottom: Spacing.base },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 52, gap: Spacing.sm },
  input: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary },
  submit: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  submitDisabled: { opacity: 0.6 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
  linkText: { fontSize: FontSizes.md, color: theme.textSecondary },
  linkBold: { color: theme.primary, fontWeight: '700' },
  footer: { alignItems: 'center', paddingVertical: Spacing.lg },
  footerText: { fontSize: FontSizes.sm, color: theme.textSecondary, fontWeight: '500' },
});
