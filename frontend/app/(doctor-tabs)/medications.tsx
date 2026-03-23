import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Pill, Search, AlertTriangle, Info, Shield } from 'lucide-react-native';

export default function DoctorMedications() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const r = await authFetch(`/api/medications/search?q=${encodeURIComponent(searchQuery)}`);
      if (r.ok) setMeds(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { search(); }, []);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Medication Database</Text>
        <Text style={s.subtitle}>On-device explainability engine</Text>

        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput
              style={s.searchInput}
              placeholder="Search medications..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={search}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={s.searchBtn} onPress={search} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Search size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>

        {meds.map(m => (
          <TouchableOpacity key={m.name} style={s.card} onPress={() => router.push(`/medication/${encodeURIComponent(m.name.toLowerCase())}`)}>
            <View style={s.cardHeader}>
              <Pill size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.medName}>{m.name}</Text>
                <Text style={s.medClass}>{m.class}</Text>
              </View>
            </View>
            <Text style={s.mechanism} numberOfLines={2}>{m.mechanism}</Text>
            <View style={s.tagRow}>
              {m.common_uses?.slice(0, 3).map((use: string, i: number) => (
                <View key={i} style={s.useTag}><Text style={s.useTagText}>{use}</Text></View>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        {searched && meds.length === 0 && !loading && (
          <View style={s.empty}>
            <AlertTriangle size={24} color={theme.textSecondary} />
            <Text style={s.emptyText}>No medications found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary },
  searchBtn: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#0033A0', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: Spacing.base, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  medName: { fontSize: FontSizes.base, fontWeight: '700', color: theme.textPrimary },
  medClass: { fontSize: FontSizes.sm, color: theme.primary, marginTop: 2 },
  mechanism: { fontSize: FontSizes.sm, color: theme.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  useTag: { backgroundColor: '#E8EEFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  useTagText: { fontSize: FontSizes.xs, color: theme.primary, fontWeight: '600' },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.base, color: theme.textSecondary },
});
