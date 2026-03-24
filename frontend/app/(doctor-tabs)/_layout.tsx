import { Tabs } from 'expo-router';
import { LayoutDashboard, Search, ClipboardList, FileText, Pill, Settings, Mic } from 'lucide-react-native';
import { theme } from '../../src/constants/theme';

export default function DoctorTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0033A0', tabBarInactiveTintColor: theme.textSecondary,
      tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, borderTopWidth: 1, height: 60, paddingBottom: 8, paddingTop: 8 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarIcon: ({ color, size }) => <Mic size={size} color={color} /> }} />
      <Tabs.Screen name="cases" options={{ title: 'Cases', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="medications" options={{ title: 'Meds', tabBarIcon: ({ color, size }) => <Pill size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings size={size} color={color} /> }} />
      {/* Lookup is still accessible as a route, but hidden from tab bar */}
      <Tabs.Screen name="lookup" options={{ href: null }} />
    </Tabs>
  );
}
