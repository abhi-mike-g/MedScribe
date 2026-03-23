import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Stethoscope, User, ShieldCheck, Mail, Calendar } from 'lucide-react-native';

type FilterRole = 'all' | 'doctor' | 'patient' | 'admin';

export default function AdminUsers() {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRole>('all');

  const load = async () => {
    setLoading(true);
    try {
      const q = filter === 'all' ? '' : `?role=${filter}`;
      const r = await authFetch(`/api/admin/users${q}`);
      if (r.ok) setUsers(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'doctor': return <Stethoscope size={16} color="#0033A0" />;
      case 'patient': return <User size={16} color="#10B981" />;
      case 'admin': return <ShieldCheck size={16} color="#7A8BFF" />;
      default: return <User size={16} color={theme.textSecondary} />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'doctor': return { bg: '#E8EEFF', text: '#0033A0' };
      case 'patient': return { bg: '#ECFDF5', text: '#065F46' };
      case 'admin': return { bg: '#ECEEFF', text: '#5B5BD6' };
      default: return { bg: theme.border, text: theme.textSecondary };
    }
  };

  const FILTERS: { key: FilterRole; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'doctor', label: 'Doctors' },
    { key: 'patient', label: 'Patients' },
    { key: 'admin', label: 'Admins' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <Text style={s.title}>User Management</Text>
        <Text style={s.subtitle}>{users.length} user{users.length !== 1 ? 's' : ''}</Text>

        <View style={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} style={[s.filterBtn, filter === f.key && s.filterActive]} onPress={() => setFilter(f.key)}>
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator size="large" color="#7A8BFF" style={{ marginTop: Spacing.xl }} /> : (
          users.map(u => {
            const rc = getRoleColor(u.role);
            return (
              <View key={u.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    {getRoleIcon(u.role)}
                    <View style={s.userInfo}>
                      <Text style={s.userName}>{u.name}</Text>
                      <View style={s.emailRow}>
                        <Mail size={12} color={theme.textSecondary} />
                        <Text style={s.emailText}>{u.email}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[s.roleBadge, { backgroundColor: rc.bg }]}>
                    <Text style={[s.roleText, { color: rc.text }]}>{u.role}</Text>
                  </View>
                </View>
                <View style={s.cardBottom}>
                  {u.patient_id ? <Text style={s.metaItem}>ID: {u.patient_id}</Text> : null}
                  {u.specialty ? <Text style={s.metaItem}>{u.specialty}</Text> : null}
                  {u.department ? <Text style={s.metaItem}>{u.department}</Text> : null}
                  <View style={s.dateRow}>
                    <Calendar size={12} color={theme.textSecondary} />
                    <Text style={s.dateText}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginBottom: Spacing.md },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  filterBtn: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  filterActive: { backgroundColor: '#7A8BFF', borderColor: '#7A8BFF' },
  filterText: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textSecondary },
  filterTextActive: { color: '#FFF' },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  emailText: { fontSize: FontSizes.sm, color: theme.textSecondary },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  roleText: { fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  cardBottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  metaItem: { fontSize: FontSizes.sm, color: theme.textSecondary, backgroundColor: theme.inputBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: FontSizes.xs, color: theme.textSecondary },
});
