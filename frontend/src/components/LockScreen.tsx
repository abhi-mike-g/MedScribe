/**
 * LockScreen — Shown when app is locked. Supports PIN entry + biometric.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration, Animated, Platform,
} from 'react-native';
import { useLock } from '../context/LockContext';
import { theme, Spacing, FontSizes } from '../constants/theme';
import { Fingerprint, ScanFace, Lock, Delete, Shield } from 'lucide-react-native';

const PIN_LENGTH = 4;

export default function LockScreen() {
  const { biometricEnabled, biometricType, authenticateBiometric, verifyPin, unlock } = useLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [shakeAnim] = useState(new Animated.Value(0));

  // Try biometric on mount
  useEffect(() => {
    if (biometricEnabled) {
      const timer = setTimeout(() => {
        authenticateBiometric();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [biometricEnabled]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const onDigitPress = useCallback(async (digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === PIN_LENGTH) {
      const valid = await verifyPin(newPin);
      if (valid) {
        unlock();
      } else {
        if (Platform.OS !== 'web') Vibration.vibrate(200);
        shake();
        setAttempts(prev => prev + 1);
        setError(attempts >= 2 ? `Wrong PIN (${attempts + 1} attempts)` : 'Wrong PIN');
        setTimeout(() => setPin(''), 300);
      }
    }
  }, [pin, verifyPin, unlock, shake, attempts]);

  const onDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, []);

  const onBiometric = useCallback(async () => {
    await authenticateBiometric();
  }, [authenticateBiometric]);

  const renderDots = () => (
    <Animated.View style={[st.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <View key={i} style={[st.dot, i < pin.length && st.dotFilled]} />
      ))}
    </Animated.View>
  );

  const renderKeypad = () => {
    const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['bio', '0', 'del']];
    return (
      <View style={st.keypad}>
        {rows.map((row, ri) => (
          <View key={ri} style={st.keyRow}>
            {row.map((key) => {
              if (key === 'bio') {
                if (!biometricEnabled) return <View key={key} style={st.keyEmpty} />;
                return (
                  <TouchableOpacity key={key} style={st.keySpecial} onPress={onBiometric} activeOpacity={0.6}>
                    {biometricType === 'Face ID' ? (
                      <ScanFace size={26} color="#0033A0" />
                    ) : (
                      <Fingerprint size={26} color="#0033A0" />
                    )}
                  </TouchableOpacity>
                );
              }
              if (key === 'del') {
                return (
                  <TouchableOpacity key={key} style={st.keySpecial} onPress={onDelete} activeOpacity={0.6}>
                    <Delete size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={key} style={st.key} onPress={() => onDigitPress(key)} activeOpacity={0.6}>
                  <Text style={st.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={st.container}>
      <View style={st.top}>
        <View style={st.lockIcon}>
          <Lock size={32} color="#FFF" />
        </View>
        <Text style={st.title}>MedScribe Locked</Text>
        <Text style={st.subtitle}>Enter your PIN to continue</Text>
        {renderDots()}
        {error ? <Text style={st.error}>{error}</Text> : null}
      </View>
      {renderKeypad()}
      <View style={st.footer}>
        <Shield size={12} color={theme.textSecondary} />
        <Text style={st.footerText}>End-to-End Encrypted</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: theme.background, justifyContent: 'space-between',
    paddingTop: 80, paddingBottom: 40,
  },
  top: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  lockIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#0033A0',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSizes.base, color: theme.textSecondary, marginTop: 6, marginBottom: Spacing.xl },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: theme.border, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#0033A0', borderColor: '#0033A0' },
  error: { color: theme.error, fontSize: FontSizes.sm, fontWeight: '600', marginTop: Spacing.md },
  keypad: { paddingHorizontal: 40 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 },
  key: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  keyText: { fontSize: 28, fontWeight: '600', color: theme.textPrimary },
  keySpecial: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  keyEmpty: { width: 72, height: 72 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  footerText: { fontSize: FontSizes.xs, color: theme.textSecondary },
});
