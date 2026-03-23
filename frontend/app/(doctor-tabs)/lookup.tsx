import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Search, Lock, User, FileText, Activity, AlertTriangle } from 'lucide-react-native';

export default function DoctorLookup() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [patientId, setPatientId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = async () => {
    if (!patientId.trim()) { setError('Enter a Patient ID'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await authFetch(`/api/doctor/lookup/${patientId.trim().toUpperCase()}`);
      if (r.ok) setResult(await r.json());
      else { const e = await r.json(); setError(e.detail || 'Patient not found'); }
    } catch (e) { setError('Lookup failed'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Patient Lookup</Text>
        <Text style={s.sub}>Enter Patient ID to access records (least privilege)</Text>

        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Search size={18} color={theme.textSecondary} />
            <TextInput testID="patient-lookup-input" style={s.searchInput} placeholder="PAT-XXXXXX" placeholderTextColor={theme.textSecondary} value={patientId} onChangeText={setPatientId} autoCapitalize="characters" />
          </View>
          <TouchableOpacity testID="lookup-submit" style={s.searchBtn} onPress={lookup} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Search size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>

        {error ? <View style={s.errBox}><AlertTriangle size={16} color={theme.error} /><Text style={s.errText}>{error}</Text></View> : null}

        {result && (
          <>
            <View style={s.patientCard}>
              <View style={s.avatar}><Text style={s.avatarT}>{result.patient.name?.charAt(0)}</Text></View>
              <View style={s.patientInfo}>
                <Text style={s.patientName}>{result.patient.name}</Text>
                <Text style={s.patientMeta}>ID: {result.patient.patient_id} • {result.patient.age}y • {result.patient.gender}</Text>
                {result.patient.blood_group ? <Text style={s.patientMeta}>Blood: {result.patient.blood_group}</Text> : null}
              </View>
              <Lock size={14} color="#10B981" />
            </View>

            <Text style={s.section}>Cases ({result.cases.length})</Text>
            {result.cases.map((c: any) => (
              <TouchableOpacity key={c.id} style={s.card} onPress={() => router.push(`/case/${c.id}`)}>
                <Activity size={16} color={c.status === 'pending' ? '#F59E0B' : '#10B981'} />
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle}>{c.chief_complaint || 'Case'}</Text>
                  <Text style={s.cardDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: c.status === 'pending' ? '#FEF3C7' : '#ECFDF5' }]}>
                  <Text style={[s.badgeT, { color: c.status === 'pending' ? '#92400E' : '#065F46' }]}>{c.status}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {result.prescriptions.length > 0 && (
              <>
                <Text style={s.section}>Prescriptions ({result.prescriptions.length})</Text>
                {result.prescriptions.map((p: any) => (
                  <TouchableOpacity key={p.id} style={s.card} onPress={() => router.push(`/prescription/${p.id}`)}>
                    <FileText size={16} color="#0033A0" />
                    <View style={s.cardInfo}>
                      <Text style={s.cardTitle}>{p.diagnosis}</Text>
                      <Text style={s.cardDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.background},scroll:{padding:Spacing.lg,paddingBottom:100},
  title:{fontSize:FontSizes.xxl,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5},
  sub:{fontSize:FontSizes.md,color:theme.textSecondary,marginTop:Spacing.xs,marginBottom:Spacing.lg},
  searchRow:{flexDirection:'row',gap:Spacing.sm,marginBottom:Spacing.lg},
  searchBox:{flex:1,flexDirection:'row',alignItems:'center',backgroundColor:theme.inputBg,borderWidth:1,borderColor:theme.border,borderRadius:8,paddingHorizontal:Spacing.md,height:52,gap:Spacing.sm},
  searchInput:{flex:1,fontSize:FontSizes.base,color:theme.textPrimary,fontWeight:'600',letterSpacing:1},
  searchBtn:{width:52,height:52,borderRadius:8,backgroundColor:'#0033A0',alignItems:'center',justifyContent:'center'},
  errBox:{flexDirection:'row',alignItems:'center',backgroundColor:theme.errorBg,padding:Spacing.md,borderRadius:6,gap:8,marginBottom:Spacing.lg},
  errText:{color:theme.error,fontSize:FontSizes.md,flex:1},
  patientCard:{flexDirection:'row',alignItems:'center',backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:Spacing.base,marginBottom:Spacing.lg},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:'#E8EEFF',alignItems:'center',justifyContent:'center'},
  avatarT:{fontSize:FontSizes.xl,fontWeight:'700',color:'#0033A0'},
  patientInfo:{flex:1,marginLeft:Spacing.md},patientName:{fontSize:FontSizes.lg,fontWeight:'700',color:theme.textPrimary},
  patientMeta:{fontSize:FontSizes.sm,color:theme.textSecondary,marginTop:2},
  section:{fontSize:FontSizes.lg,fontWeight:'700',color:theme.textPrimary,marginBottom:Spacing.md,marginTop:Spacing.md},
  card:{flexDirection:'row',alignItems:'center',backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:Spacing.base,marginBottom:Spacing.sm,gap:Spacing.md},
  cardInfo:{flex:1},cardTitle:{fontSize:FontSizes.base,fontWeight:'600',color:theme.textPrimary},
  cardDate:{fontSize:FontSizes.sm,color:theme.textSecondary,marginTop:2},
  badge:{paddingHorizontal:8,paddingVertical:3,borderRadius:9999},badgeT:{fontSize:FontSizes.xs,fontWeight:'700',textTransform:'capitalize'},
});
