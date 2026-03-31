/**
 * SyncContext — Manages multi-device encrypted cloud sync.
 * 
 * Syncs: preferences, E2EE key metadata, device registry, sync timestamps.
 * Medical data (cases, prescriptions, reports) already lives on the server.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';

const DEVICE_ID_KEY = 'medscribe_device_id';
const LAST_SYNC_KEY = 'medscribe_last_sync';

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  app_version: string;
  last_sync: string;
  registered_at: string;
  is_current: boolean;
}

export interface SyncState {
  last_sync: string | null;
  syncing: boolean;
  devices: DeviceInfo[];
  deviceId: string | null;
  syncNow: () => Promise<void>;
  removeDevice: (deviceId: string) => Promise<boolean>;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError: string | null;
}

const SyncContext = createContext<SyncState>({} as SyncState);
export const useSync = () => useContext(SyncContext);

function generateDeviceId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'DEV-';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDeviceName(): string {
  if (Platform.OS === 'web') return 'Web Browser';
  if (Platform.OS === 'ios') return 'iPhone';
  if (Platform.OS === 'android') return 'Android Device';
  return 'Unknown Device';
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { token, user, authFetch } = useAuth();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize device ID
  useEffect(() => {
    const initDevice = async () => {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      setDeviceId(id);
      
      const ls = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (ls) setLastSync(ls);
    };
    initDevice();
  }, []);

  // Register device and start sync when authenticated
  useEffect(() => {
    if (token && deviceId && user) {
      registerDevice();
      syncNow();

      // Auto-sync every 5 minutes
      syncIntervalRef.current = setInterval(() => {
        syncNow();
      }, 5 * 60 * 1000);

      return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      };
    }
  }, [token, deviceId, user?.id]);

  const registerDevice = useCallback(async () => {
    if (!token || !deviceId) return;
    try {
      const appVersion = Application.nativeApplicationVersion || '1.0.0';
      await authFetch('/api/sync/register-device', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          device_name: getDeviceName(),
          platform: Platform.OS,
          app_version: appVersion,
        }),
      });
    } catch (e) {
      console.log('Device registration error:', e);
    }
  }, [token, deviceId, authFetch]);

  const syncNow = useCallback(async () => {
    if (!token || !deviceId || syncing) return;
    setSyncing(true);
    setSyncStatus('syncing');
    setLastError(null);

    try {
      // 1. Push local preferences
      const preferences = await getLocalPreferences();
      await authFetch('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          preferences: preferences,
          timestamp: new Date().toISOString(),
        }),
      });

      // 2. Pull latest state
      const pullRes = await authFetch('/api/sync/pull');
      if (pullRes.ok) {
        const data = await pullRes.json();
        // Apply server preferences if newer
        if (data.preferences && data.sync_timestamp) {
          const localTs = lastSync ? new Date(lastSync).getTime() : 0;
          const serverTs = new Date(data.sync_timestamp).getTime();
          if (serverTs > localTs) {
            await applyServerPreferences(data.preferences);
          }
        }
      }

      // 3. Fetch device list
      const devRes = await authFetch('/api/sync/devices');
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData.map((d: any) => ({
          ...d,
          is_current: d.device_id === deviceId,
          id: d.device_id,
        })));
      }

      // 4. Update sync timestamp
      const now = new Date().toISOString();
      setLastSync(now);
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      setSyncStatus('success');
    } catch (e: any) {
      console.log('Sync error:', e);
      setSyncStatus('error');
      setLastError(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [token, deviceId, syncing, authFetch, lastSync]);

  const removeDevice = useCallback(async (targetDeviceId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await authFetch(`/api/sync/devices/${targetDeviceId}`, { method: 'DELETE' });
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.id !== targetDeviceId));
        return true;
      }
      return false;
    } catch (e) {
      console.error('Remove device error:', e);
      return false;
    }
  }, [token, authFetch]);

  return (
    <SyncContext.Provider value={{
      last_sync: lastSync, syncing, devices, deviceId,
      syncNow, removeDevice, syncStatus, lastError,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

// ============== LOCAL PREFERENCE HELPERS ==============

async function getLocalPreferences(): Promise<Record<string, any>> {
  try {
    const keys = ['medscribe_biometric_enabled', 'medscribe_notification_pref', 'medscribe_theme'];
    const prefs: Record<string, any> = {};
    for (const key of keys) {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) prefs[key] = val;
    }
    return prefs;
  } catch {
    return {};
  }
}

async function applyServerPreferences(prefs: Record<string, any>) {
  try {
    for (const [key, value] of Object.entries(prefs)) {
      if (typeof value === 'string') {
        await AsyncStorage.setItem(key, value);
      }
    }
  } catch (e) {
    console.error('Apply prefs error:', e);
  }
}
