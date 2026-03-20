import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Search, Plus, User, Lock, ChevronRight, X } from 'lucide-react-native';

export default function PatientsScreen() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', age: '', gender: 'Male', phone: '', blood_group: '' });
  const [addLoading, setAddLoading] = useState(false);

  const loadPatients = async () => {
    try {
      const res = await authFetch('/api/patients');
      if (res.ok) setPatients(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadPatients(); }, []));

  const addPatient = async () => {
    if (!newPatient.name || !newPatient.age) return;
    setAddLoading(true);
    try {
      const res = await authFetch('/api/patients', {
        method: 'POST',
        body: JSON.stringify({ ...newPatient, age: parseInt(newPatient.age), allergies: [], medical_history: [] }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewPatient({ name: '', age: '', gender: 'Male', phone: '', blood_group: '' });
        loadPatients();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAddLoading(false);
    }
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Patients</Text>
        <TouchableOpacity testID="add-patient-button" style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={18} color="#FFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <Search size={18} color={theme.textSecondary} />
        <TextInput
          testID="patient-search-input"
          style={styles.searchInput}
          placeholder="Search patients..."
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPatients(); }} tintColor={theme.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <User size={32} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No patients found</Text>
              <Text style={styles.emptySubtext}>Add your first patient to get started</Text>
            </View>
          ) : (
            filtered.map(p => (
              <TouchableOpacity
                testID={`patient-card-${p.id}`}
                key={p.id}
                style={styles.patientCard}
                onPress={() => router.push(`/patient/${p.id}`)}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{p.name}</Text>
                  <Text style={styles.patientMeta}>{p.age}y • {p.gender} {p.blood_group ? `• ${p.blood_group}` : ''}</Text>
                </View>
                <View style={styles.patientRight}>
                  <Lock size={12} color="#10B981" />
                  <ChevronRight size={16} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Patient</Text>
              <TouchableOpacity testID="close-add-patient-modal" onPress={() => setShowAddModal(false)}>
                <X size={22} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PATIENT NAME</Text>
                <TextInput testID="new-patient-name" style={styles.modalInput} placeholder="Full name" placeholderTextColor={theme.textSecondary} value={newPatient.name} onChangeText={t => setNewPatient(p => ({ ...p, name: t }))} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>AGE</Text>
                <TextInput testID="new-patient-age" style={styles.modalInput} placeholder="Age" placeholderTextColor={theme.textSecondary} value={newPatient.age} onChangeText={t => setNewPatient(p => ({ ...p, age: t }))} keyboardType="numeric" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>GENDER</Text>
                <View style={styles.genderRow}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <TouchableOpacity
                      testID={`gender-${g.toLowerCase()}`}
                      key={g}
                      style={[styles.genderButton, newPatient.gender === g && styles.genderButtonActive]}
                      onPress={() => setNewPatient(p => ({ ...p, gender: g }))}
                    >
                      <Text style={[styles.genderText, newPatient.gender === g && styles.genderTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PHONE</Text>
                <TextInput testID="new-patient-phone" style={styles.modalInput} placeholder="Optional" placeholderTextColor={theme.textSecondary} value={newPatient.phone} onChangeText={t => setNewPatient(p => ({ ...p, phone: t }))} keyboardType="phone-pad" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>BLOOD GROUP</Text>
                <TextInput testID="new-patient-blood-group" style={styles.modalInput} placeholder="e.g. O+" placeholderTextColor={theme.textSecondary} value={newPatient.blood_group} onChangeText={t => setNewPatient(p => ({ ...p, blood_group: t }))} />
              </View>
            </ScrollView>

            <TouchableOpacity testID="submit-add-patient" style={[styles.submitButton, addLoading && styles.submitDisabled]} onPress={addPatient} disabled={addLoading}>
              {addLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Add Patient Securely</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: 9999, gap: 6 },
  addButtonText: { color: '#FFF', fontSize: FontSizes.md, fontWeight: '600' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginHorizontal: Spacing.lg, paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm, marginBottom: Spacing.base },
  searchInput: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  patientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.primary },
  patientInfo: { flex: 1, marginLeft: Spacing.md },
  patientName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  patientMeta: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  patientRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyCard: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8 },
  emptyText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textSecondary, marginTop: Spacing.md },
  emptySubtext: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: theme.textPrimary },
  inputGroup: { marginBottom: Spacing.base },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  modalInput: { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSizes.base, color: theme.textPrimary },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderButton: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.inputBg },
  genderButtonActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  genderText: { fontSize: FontSizes.md, color: theme.textSecondary, fontWeight: '600' },
  genderTextActive: { color: '#FFF' },
  submitButton: { backgroundColor: theme.primary, height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.base },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontSize: FontSizes.base, fontWeight: '700' },
});
