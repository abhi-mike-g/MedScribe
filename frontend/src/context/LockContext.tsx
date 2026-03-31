/**
 * LockContext — Manages app lock state (PIN + Biometric)
 * 
 * Flow:
 * 1. User logs in → check if PIN exists → if not, require setup
 * 2. App reopens → show lock screen → biometric (if enabled) or PIN
 * 3. Settings → toggle biometric, change PIN
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'medscribe_pin_hash';
const BIO_KEY = 'medscribe_biometric_enabled';
const LOCK_TIMEOUT_KEY = 'medscribe_lock_timeout';
const LAST_ACTIVE_KEY = 'medscribe_last_active';

interface LockContextType {
  isLocked: boolean;
  hasPinSetup: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricType: string;
  loading: boolean;
  verifyPin: (pin: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  removePin: () => Promise<void>;
  toggleBiometric: (enable: boolean) => Promise<boolean>;
  authenticateBiometric: () => Promise<boolean>;
  unlock: () => void;
  lockApp: () => void;
  resetLockState: () => Promise<void>;
}

const LockContext = createContext<LockContextType>({} as LockContextType);
export const useLock = () => useContext(LockContext);

// Simple hash for PIN (not crypto-grade, but sufficient for local app lock)
function hashPin(pin: string): string {
  let hash = 0;
  const str = `medscribe_salt_${pin}_v2`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

const LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds background → lock

export function LockProvider({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPinSetup, setHasPinSetup] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const backgroundTimestampRef = useRef<number>(0);

  // Check biometric hardware availability
  const checkBiometricHardware = useCallback(async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      
      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris');
        } else {
          setBiometricType('Biometric');
        }
      }
    } catch (e) {
      console.log('Biometric check error:', e);
      setBiometricAvailable(false);
    }
  }, []);

  // Load stored state
  const loadState = useCallback(async () => {
    try {
      // Check PIN
      let pinHash: string | null = null;
      if (Platform.OS === 'web') {
        pinHash = await AsyncStorage.getItem(PIN_KEY);
      } else {
        pinHash = await SecureStore.getItemAsync(PIN_KEY);
      }
      setHasPinSetup(!!pinHash);

      // Check biometric preference
      const bioEnabled = await AsyncStorage.getItem(BIO_KEY);
      setBiometricEnabled(bioEnabled === 'true');

      // Check biometric hardware
      await checkBiometricHardware();

      // If user is authenticated and has PIN, lock the app
      if (isAuthenticated && pinHash) {
        setIsLocked(true);
      }
    } catch (e) {
      console.error('Lock state load error:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, checkBiometricHardware]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState.match(/inactive|background/)) {
        // Going to background — record timestamp
        backgroundTimestampRef.current = Date.now();
      } else if (nextState === 'active' && appStateRef.current.match(/inactive|background/)) {
        // Coming back — check if lock timeout exceeded
        const elapsed = Date.now() - backgroundTimestampRef.current;
        if (elapsed > LOCK_TIMEOUT_MS && hasPinSetup && isAuthenticated) {
          setIsLocked(true);
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [hasPinSetup, isAuthenticated]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      let storedHash: string | null = null;
      if (Platform.OS === 'web') {
        storedHash = await AsyncStorage.getItem(PIN_KEY);
      } else {
        storedHash = await SecureStore.getItemAsync(PIN_KEY);
      }
      return storedHash === hashPin(pin);
    } catch (e) {
      console.error('PIN verify error:', e);
      return false;
    }
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    try {
      const hashed = hashPin(pin);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(PIN_KEY, hashed);
      } else {
        await SecureStore.setItemAsync(PIN_KEY, hashed);
      }
      setHasPinSetup(true);
      setIsLocked(false);
    } catch (e) {
      console.error('PIN setup error:', e);
      throw e;
    }
  }, []);

  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const valid = await verifyPin(oldPin);
    if (!valid) return false;
    await setupPin(newPin);
    return true;
  }, [verifyPin, setupPin]);

  const removePin = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(PIN_KEY);
      } else {
        await SecureStore.deleteItemAsync(PIN_KEY);
      }
      setHasPinSetup(false);
      setBiometricEnabled(false);
      await AsyncStorage.setItem(BIO_KEY, 'false');
    } catch (e) {
      console.error('PIN remove error:', e);
    }
  }, []);

  const toggleBiometric = useCallback(async (enable: boolean): Promise<boolean> => {
    if (enable) {
      // Verify biometric works first
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable biometric lock',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });
      if (!result.success) return false;
    }
    await AsyncStorage.setItem(BIO_KEY, enable ? 'true' : 'false');
    setBiometricEnabled(enable);
    return true;
  }, []);

  const authenticateBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MedScribe',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Biometric auth error:', e);
      return false;
    }
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  const lockApp = useCallback(() => {
    if (hasPinSetup) {
      setIsLocked(true);
    }
  }, [hasPinSetup]);

  const resetLockState = useCallback(async () => {
    // Called on logout — clear all lock data
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(PIN_KEY);
      } else {
        await SecureStore.deleteItemAsync(PIN_KEY);
      }
      await AsyncStorage.removeItem(BIO_KEY);
      setHasPinSetup(false);
      setBiometricEnabled(false);
      setIsLocked(false);
    } catch (e) {
      console.error('Reset lock state error:', e);
    }
  }, []);

  return (
    <LockContext.Provider value={{
      isLocked, hasPinSetup, biometricEnabled, biometricAvailable, biometricType,
      loading, verifyPin, setupPin, changePin, removePin, toggleBiometric,
      authenticateBiometric, unlock, lockApp, resetLockState,
    }}>
      {children}
    </LockContext.Provider>
  );
}
