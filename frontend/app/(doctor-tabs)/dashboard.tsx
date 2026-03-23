import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme, Spacing, FontSizes } from '../../src/constants/theme';
import { Shield, Lock, ClipboardList, FileText, ChevronRight, Activity, Stethoscope } from 'lucide-react-native';

export default function DoctorDashboard() {
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const r = await authFetch('/api/dashboard/stats'); if (r.ok) setStats(await r.json()); } catch(e) {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#0033A0" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={s.headerRow}>
          <View><Text style={s.greeting}>Welcome back,</Text><Text style={s.name}>Dr. {user?.name?.split(' ').pop()}</Text></View>
          <View style={s.badge}><Stethoscope size={20} color="#0033A0" /></View>
        </View>
        <View style={s.e2ee}><Lock size={12} color="#10B981" /><Text style={s.e2eeT}>E2EE Active — {stats?.encryption_status}</Text></View>
        <View style={s.statsRow}>
          <View style={s.stat}><ClipboardList size={22} color="#F59E0B" /><Text style={s.statNum}>{stats?.pending_cases || 0}</Text><Text style={s.statLabel}>PENDING</Text></View>
          <View style={s.stat}><Activity size={22} color="#0033A0" /><Text style={s.statNum}>{stats?.patient_count || 0}</Text><Text style={s.statLabel}>ASSIGNED</Text></View>
          <View style={s.stat}><FileText size={22} color="#10B981" /><Text style={s.statNum}>{stats?.prescription_count || 0}</Text><Text style={s.statLabel}>Rx</Text></View>
        </View>
        <Text style={s.section}>Recent Cases</Text>
        {stats?.recent_cases?.length ? stats.recent_cases.map((c: any) => (
          <TouchableOpacity testID={`case-${c.id}`} key={c.id} style={s.card} onPress={() => router.push(`/case/${c.id}`)}>
            <View style={s.cardLeft}>
              <Activity size={16} color={c.status === 'pending' ? '#F59E0B' : '#10B981'} />
              <View><Text style={s.cardName}>{c.patient_name}</Text><Text style={s.cardMeta}>{c.patient_id} • {new Date(c.created_at).toLocaleDateString()}</Text></View>
            </View>
            <View style={[s.statusBadge, { backgroundColor: c.status === 'pending' ? '#FEF3C7' : '#ECFDF5' }]}>
              <Text style={[s.statusText, { color: c.status === 'pending' ? '#92400E' : '#065F46' }]}>{c.status}</Text>
            </View>
          </TouchableOpacity>
        )) : <View style={s.empty}><Text style={s.emptyT}>No cases yet</Text></View>}
        <View style={s.compliance}><Shield size={14} color="#0033A0" /><Text style={s.complianceT}>HIPAA & GDPR Compliant • Doctor Portal</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.background},center:{flex:1,alignItems:'center',justifyContent:'center'},
  scroll:{padding:Spacing.lg,paddingBottom:100},headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:Spacing.base},
  greeting:{fontSize:FontSizes.md,color:theme.textSecondary},name:{fontSize:FontSizes.xxl,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5},
  badge:{width:44,height:44,borderRadius:12,backgroundColor:'#E8EEFF',alignItems:'center',justifyContent:'center'},
  e2ee:{flexDirection:'row',alignItems:'center',backgroundColor:'#052E16',paddingHorizontal:Spacing.md,paddingVertical:8,borderRadius:6,marginBottom:Spacing.lg,gap:8},
  e2eeT:{fontSize:FontSizes.sm,color:'#10B981',fontWeight:'600'},
  statsRow:{flexDirection:'row',gap:Spacing.md,marginBottom:Spacing.xl},
  stat:{flex:1,backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:Spacing.base,alignItems:'center',gap:Spacing.sm},
  statNum:{fontSize:FontSizes.xxl,fontWeight:'800',color:theme.textPrimary},statLabel:{fontSize:FontSizes.xs,fontWeight:'700',color:theme.textSecondary,letterSpacing:1.5},
  section:{fontSize:FontSizes.lg,fontWeight:'700',color:theme.textPrimary,marginBottom:Spacing.md},
  card:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:Spacing.base,marginBottom:Spacing.sm},
  cardLeft:{flexDirection:'row',alignItems:'center',gap:Spacing.md,flex:1},cardName:{fontSize:FontSizes.base,fontWeight:'600',color:theme.textPrimary},
  cardMeta:{fontSize:FontSizes.sm,color:theme.textSecondary,marginTop:2},
  statusBadge:{paddingHorizontal:10,paddingVertical:4,borderRadius:9999},statusText:{fontSize:FontSizes.xs,fontWeight:'700',textTransform:'capitalize'},
  empty:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:Spacing.xl,alignItems:'center'},
  emptyT:{fontSize:FontSizes.base,color:theme.textSecondary},
  compliance:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:Spacing.lg},
  complianceT:{fontSize:FontSizes.sm,color:theme.textSecondary},
});
