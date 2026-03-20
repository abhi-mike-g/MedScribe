import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Shield, Lock, Cpu, Key, LogOut, ChevronRight, User, FileText, Database, Fingerprint } from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <User size={24} color={theme.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileSpecialty}>{user?.specialty}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SECURITY & ENCRYPTION</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#ECFDF5' }]}>
                <Lock size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.settingTitle}>End-to-End Encryption</Text>
                <Text style={styles.settingDesc}>AES-256-GCM Active</Text>
              </View>
            </View>
            <View style={styles.activeBadge}><Text style={styles.activeText}>ACTIVE</Text></View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#E8EEFF' }]}>
                <Key size={18} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Key Management</Text>
                <Text style={styles.settingDesc}>Android Keystore System</Text>
              </View>
            </View>
            <View style={styles.secureBadge}><Text style={styles.secureText}>SECURE</Text></View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#FEF3C7' }]}>
                <Fingerprint size={18} color="#92400E" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Biometric Lock</Text>
                <Text style={styles.settingDesc}>Fingerprint / Face ID</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.textSecondary} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>ON-DEVICE AI</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#E8EEFF' }]}>
                <Cpu size={18} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Speech-to-Text Engine</Text>
                <Text style={styles.settingDesc}>whisper-cpp-base.en (Quantized)</Text>
              </View>
            </View>
            <View style={styles.loadedBadge}><Text style={styles.loadedText}>LOADED</Text></View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#E8EEFF' }]}>
                <Cpu size={18} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Medical LLM</Text>
                <Text style={styles.settingDesc}>phi-3-mini-4k-q4 (On-Device)</Text>
              </View>
            </View>
            <View style={styles.loadedBadge}><Text style={styles.loadedText}>LOADED</Text></View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#E8EEFF' }]}>
                <Database size={18} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Hardware Acceleration</Text>
                <Text style={styles.settingDesc}>NNAPI + GPU Delegate</Text>
              </View>
            </View>
            <View style={styles.activeBadge}><Text style={styles.activeText}>ON</Text></View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>COMPLIANCE</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#ECFDF5' }]}>
                <Shield size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.settingTitle}>HIPAA Compliance</Text>
                <Text style={styles.settingDesc}>PHI processed locally only</Text>
              </View>
            </View>
            <View style={styles.activeBadge}><Text style={styles.activeText}>COMPLIANT</Text></View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#ECFDF5' }]}>
                <Shield size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.settingTitle}>GDPR Compliance</Text>
                <Text style={styles.settingDesc}>PII stays on-device</Text>
              </View>
            </View>
            <View style={styles.activeBadge}><Text style={styles.activeText}>COMPLIANT</Text></View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#E8EEFF' }]}>
                <FileText size={18} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Audit Log</Text>
                <Text style={styles.settingDesc}>View access and modification logs</Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.textSecondary} />
          </View>
        </View>

        <TouchableOpacity testID="logout-button" style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={theme.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MedScribe v1.0.0 — Local-First Architecture</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: Spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.xl },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  profileInfo: { marginLeft: Spacing.md },
  profileName: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary },
  profileEmail: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: 2 },
  profileSpecialty: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '500', marginTop: 2 },
  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  section: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginBottom: Spacing.base },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  iconBg: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary },
  settingDesc: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 1 },
  divider: { height: 1, backgroundColor: theme.border, marginHorizontal: Spacing.base },
  activeBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  activeText: { fontSize: FontSizes.xs, fontWeight: '700', color: '#065F46' },
  secureBadge: { backgroundColor: '#E8EEFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  secureText: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.primary },
  loadedBadge: { backgroundColor: '#E8EEFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  loadedText: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.primary },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.errorBg, height: 52, borderRadius: 8, marginTop: Spacing.xl, gap: Spacing.sm },
  logoutText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.error },
  version: { textAlign: 'center', fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: Spacing.lg },
});
