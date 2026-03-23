import { Tabs } from 'expo-router';
import { Home, Mic, ClipboardList, FileText, Settings } from 'lucide-react-native';
import { theme } from '../../src/constants/theme';

export default function PatientTabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#10B981',
      tabBarInactiveTintColor: theme.textSecondary,
      tabBarStyle: {
        backgroundColor: theme.surface,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarIcon: ({ color, size }) => <Mic size={size} color={color} /> }} />
      <Tabs.Screen name="cases" options={{ title: 'My Cases', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="prescriptions" options={{ title: 'Rx', tabBarIcon: ({ color, size }) => <FileText size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings size={size} color={color} /> }} />
    </Tabs>
  );
}
