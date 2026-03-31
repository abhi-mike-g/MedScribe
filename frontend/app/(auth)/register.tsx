import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, UserRole } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Shield, ChevronLeft, ChevronRight, Stethoscope, User, ShieldCheck } from 'lucide-react-native';

const ROLES: { key: UserRole; label: string; icon: any; color: string }[] = [
  { key: 'doctor', label: 'Doctor', icon: Stethoscope, color: '#0033A0' },
  { key: 'patient', label: 'Patient', icon: User, color: '#10B981' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, color: '#7A8BFF' },
];

export default function RegisterScreen() {
  const [role, setRole] = useState<UserRole>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [license, setLicense] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerDoctor, registerPatient, registerAdmin } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Name, email and password are required'); return; }
    if (role === 'doctor' && (!license || !/^[A-Za-z0-9]{4,12}$/.test(license))) { setError('License number is required (4-12 alphanumeric characters)'); return; }
    if (role === 'patient' && !/^[A-Za-z\s.\-]+$/.test(name)) { setError('Name must contain only letters'); return; }
    if (role === 'patient' && (!age || isNaN(Number(age)))) { setError('Age must be a valid number'); return; }
    setLoading(true); setError('');
    try {
      if (role === 'doctor') {
        await registerDoctor({ name, email, password, specialty: specialty || 'General Medicine', license_number: license });
      } else if (role === 'patient') {
        await registerPatient({ name, email, password, age: parseInt(age), gender, phone, blood_group: bloodGroup });
      } else {
        await registerAdmin({ name, email, password, department: department || 'Administration' });
      }
      // Navigate immediately — PIN setup modal will overlay the dashboard if needed
      const targets: Record<string, string> = {
        doctor: '/(doctor-tabs)/dashboard',
        patient: '/(patient-tabs)/home',
        admin: '/(admin-tabs)/overview',
      };
      router.replace(targets[role] || '/');
    } catch (e: any) { setError(e.message || 'Registration failed'); setLoading(false); }
  };

  const sel = ROLES.find(r => r.key === role)!;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="register-back" onPress={() => router.back()} style={s.back}>
            <ChevronLeft size={20} color={theme.textPrimary} /><Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <View style={s.hdr}><Shield size={24} color={theme.primary} /><Text style={s.title}>Create Account</Text></View>

          <Text style={s.roleLabel}>REGISTER AS</Text>
          <View style={s.roleRow}>
            {ROLES.map(r => {
              const Icon = r.icon; const a = role === r.key;
              return (
                <TouchableOpacity testID={`reg-role-${r.key}`} key={r.key} style={[s.roleCard, a && { borderColor: r.color, backgroundColor: r.color + '10' }]} onPress={() => setRole(r.key)}>
                  <Icon size={20} color={a ? r.color : theme.textSecondary} />
                  <Text style={[s.roleText, a && { color: r.color, fontWeight: '700' }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error ? <View style={s.err}><Text style={s.errT}>{error}</Text></View> : null}

          <InputField testID="reg-name" label="FULL NAME" value={name} onChangeText={setName} placeholder={role === 'patient' ? 'Letters only' : 'Full name'} />
          <InputField testID="reg-email" label="EMAIL" value={email} onChangeText={setEmail} placeholder="email@clinic.com" keyboardType="email-address" autoCapitalize="none" />
          <InputField testID="reg-password" label="PASSWORD" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry />

          {role === 'doctor' && (
            <>
              <InputField testID="reg-specialty" label="SPECIALTY" value={specialty} onChangeText={setSpecialty} placeholder="e.g. General Medicine" />
              <InputField testID="reg-license" label="LICENSE NUMBER *" value={license} onChangeText={setLicense} placeholder="4-12 alphanumeric (required)" />
            </>
          )}

          {role === 'patient' && (
            <>
              <InputField testID="reg-age" label="AGE (NUMERIC ONLY)" value={age} onChangeText={setAge} placeholder="e.g. 35" keyboardType="numeric" />
              <Text style={s.fieldLabel}>GENDER</Text>
              <View style={s.genderRow}>
                {['Male', 'Female', 'Other'].map(g => (
                  <TouchableOpacity testID={`reg-gender-${g.toLowerCase()}`} key={g} style={[s.genderBtn, gender === g && s.genderActive]} onPress={() => setGender(g)}>
                    <Text style={[s.genderText, gender === g && s.genderTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <InputField testID="reg-phone" label="PHONE" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
              <InputField testID="reg-blood" label="BLOOD GROUP" value={bloodGroup} onChangeText={setBloodGroup} placeholder="e.g. O+" />
            </>
          )}

          {role === 'admin' && (
            <InputField testID="reg-dept" label="DEPARTMENT" value={department} onChangeText={setDepartment} placeholder="e.g. Administration" />
          )}

          <TouchableOpacity testID="register-submit" style={[s.submit, { backgroundColor: sel.color }, loading && s.submitDis]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <View style={s.btnRow}><Text style={s.submitText}>Register as {sel.label}</Text><ChevronRight size={18} color="#FFF" /></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity testID="goto-login" onPress={() => router.push('/(auth)/login')} style={s.link}>
            <Text style={s.linkText}>Already have an account? <Text style={s.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputField({ testID, label, ...props }: any) {
  return (
    <View style={s.inputGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput testID={testID} style={s.input} placeholderTextColor={theme.textSecondary} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary },
  roleLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  roleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  roleCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: 8, borderWidth: 2, borderColor: theme.border, gap: 4 },
  roleText: { fontSize: FontSizes.sm, color: theme.textSecondary },
  err: { backgroundColor: theme.errorBg, padding: Spacing.md, borderRadius: 6, marginBottom: Spacing.base, borderLeftWidth: 3, borderLeftColor: theme.error },
  errT: { color: theme.error, fontSize: FontSizes.md },
  inputGroup: { marginBottom: Spacing.base },
  fieldLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  input: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSizes.base, color: theme.textPrimary },
  genderRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  genderBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.inputBg },
  genderActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  genderText: { fontSize: FontSizes.md, color: theme.textSecondary, fontWeight: '600' },
  genderTextActive: { color: '#FFF' },
  submit: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  submitDis: { opacity: 0.6 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.sm },
  linkText: { fontSize: FontSizes.md, color: theme.textSecondary },
  linkBold: { color: theme.primary, fontWeight: '700' },
});
