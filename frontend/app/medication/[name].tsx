import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { ChevronLeft, Pill, AlertTriangle, Beaker, Search, Info, Shield } from 'lucide-react-native';

export default function MedicationScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { authFetch } = useAuth();
  const router = useRouter();
  const [medication, setMedication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allMeds, setAllMeds] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (name) loadMedication(name);
    else {
      setShowSearch(true);
      loadAllMeds();
    }
  }, [name]);

  const loadMedication = async (medName: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/medications/${encodeURIComponent(medName)}/explain`);
      if (res.ok) {
        setMedication(await res.json());
        setShowSearch(false);
      } else {
        setShowSearch(true);
        loadAllMeds();
      }
    } catch (e) {
      setShowSearch(true);
      loadAllMeds();
    } finally {
      setLoading(false);
    }
  };

  const loadAllMeds = async () => {
    try {
      const res = await authFetch('/api/medications/search?q=');
      if (res.ok) setAllMeds(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMeds = allMeds.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.class.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-medication" onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color={theme.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {showSearch && (
          <>
            <Text style={styles.title}>Medication Database</Text>
            <Text style={styles.subtitle}>Explainability engine — On-device reference</Text>

            <View style={styles.searchWrapper}>
              <Search size={18} color={theme.textSecondary} />
              <TextInput
                testID="medication-search-input"
                style={styles.searchInput}
                placeholder="Search medications..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {filteredMeds.map(m => (
              <TouchableOpacity
                testID={`med-item-${m.name.toLowerCase()}`}
                key={m.name}
                style={styles.medListItem}
                onPress={() => { setMedication(m); setShowSearch(false); }}
              >
                <Pill size={18} color={theme.primary} />
                <View style={styles.medListInfo}>
                  <Text style={styles.medListName}>{m.name}</Text>
                  <Text style={styles.medListClass}>{m.class}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {medication && !showSearch && (
          <>
            <View style={styles.medHeader}>
              <Pill size={28} color={theme.primary} />
              <View>
                <Text style={styles.medName}>{medication.name}</Text>
                <Text style={styles.medClass}>{medication.class}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Beaker size={16} color={theme.primary} />
                <Text style={styles.cardLabel}>MECHANISM OF ACTION</Text>
              </View>
              <Text style={styles.cardText}>{medication.mechanism}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>COMMON USES</Text>
              <View style={styles.tagRow}>
                {medication.common_uses?.map((use: string, i: number) => (
                  <View key={i} style={styles.useTag}><Text style={styles.useTagText}>{use}</Text></View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>DOSAGE RANGE</Text>
              <Text style={styles.dosageText}>{medication.dosage_range}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <AlertTriangle size={16} color={theme.warning} />
                <Text style={styles.cardLabel}>SIDE EFFECTS</Text>
              </View>
              {medication.side_effects?.map((se: string, i: number) => (
                <Text key={i} style={styles.listItem}>• {se}</Text>
              ))}
            </View>

            <View style={[styles.card, styles.dangerCard]}>
              <View style={styles.cardHeader}>
                <AlertTriangle size={16} color={theme.error} />
                <Text style={[styles.cardLabel, { color: theme.error }]}>CONTRAINDICATIONS</Text>
              </View>
              {medication.contraindications?.map((c: string, i: number) => (
                <Text key={i} style={[styles.listItem, { color: theme.error }]}>• {c}</Text>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Info size={16} color={theme.primary} />
                <Text style={styles.cardLabel}>DRUG INTERACTIONS</Text>
              </View>
              <View style={styles.tagRow}>
                {medication.interactions?.map((inter: string, i: number) => (
                  <View key={i} style={styles.interactionTag}><Text style={styles.interactionText}>{inter}</Text></View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Shield size={16} color={theme.primary} />
                <Text style={styles.cardLabel}>PREGNANCY CATEGORY</Text>
              </View>
              <Text style={styles.pregnancyText}>{medication.pregnancy_category}</Text>
            </View>

            <TouchableOpacity testID="search-another-med" style={styles.searchButton} onPress={() => { setShowSearch(true); setSearchQuery(''); }}>
              <Search size={16} color={theme.primary} />
              <Text style={styles.searchButtonText}>Search Another Medication</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: FontSizes.base, color: theme.textPrimary },
  scroll: { padding: Spacing.lg, paddingBottom: 100 },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.md, color: theme.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: Spacing.md, height: 48, gap: Spacing.sm, marginBottom: Spacing.lg },
  searchInput: { flex: 1, fontSize: FontSizes.base, color: theme.textPrimary },
  medListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.md },
  medListInfo: { flex: 1 },
  medListName: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary },
  medListClass: { fontSize: FontSizes.sm, color: theme.textSecondary, marginTop: 2 },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  medName: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  medClass: { fontSize: FontSizes.md, color: theme.primary, fontWeight: '500', marginTop: 2 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: Spacing.base, marginBottom: Spacing.md },
  dangerCard: { borderColor: theme.error, backgroundColor: '#FEF2F2' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  cardLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm },
  cardText: { fontSize: FontSizes.base, color: theme.textPrimary, lineHeight: 24 },
  dosageText: { fontSize: FontSizes.lg, fontWeight: '600', color: theme.textPrimary },
  listItem: { fontSize: FontSizes.base, color: theme.textPrimary, marginBottom: 4, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  useTag: { backgroundColor: '#E8EEFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  useTagText: { fontSize: FontSizes.sm, color: theme.primary, fontWeight: '600' },
  interactionTag: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  interactionText: { fontSize: FontSizes.sm, color: '#92400E', fontWeight: '600' },
  pregnancyText: { fontSize: FontSizes.lg, fontWeight: '700', color: theme.textPrimary },
  searchButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary, height: 48, borderRadius: 9999, gap: Spacing.sm, marginTop: Spacing.md },
  searchButtonText: { fontSize: FontSizes.base, color: theme.primary, fontWeight: '600' },
});
