/**
 * PinSetup — First-time PIN creation flow.
 * Shows a 2-step flow: enter PIN → confirm PIN.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Vibration,
} from 'react-native';
import { useLock } from '../context/LockContext';
import { theme, Spacing, FontSizes } from '../constants/theme';
import { KeyRound, Delete, Shield, Check } from 'lucide-react-native';

const PIN_LENGTH = 4;

export default function PinSetup() {
  const { setupPin } = useLock();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));

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
      if (step === 'create') {
        // Move to confirm step
        setFirstPin(newPin);
        setStep('confirm');
        setTimeout(() => setPin(''), 200);
      } else {
        // Confirm step — check match
        if (newPin === firstPin) {
          await setupPin(newPin);
        } else {
          if (Platform.OS !== 'web') Vibration.vibrate(200);
          shake();
          setError('PINs do not match. Try again.');
          setStep('create');
          setFirstPin('');
          setTimeout(() => setPin(''), 300);
        }
      }
    }
  }, [pin, step, firstPin, setupPin, shake]);

  const onDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, []);

  const renderDots = () => (
    <Animated.View style={[st.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <View key={i} style={[st.dot, i < pin.length && st.dotFilled]} />
      ))}
    </Animated.View>
  );

  const renderKeypad = () => {
    const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];
    return (
      <View style={st.keypad}>
        {rows.map((row, ri) => (
          <View key={ri} style={st.keyRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={`empty-${ki}`} style={st.keyEmpty} />;
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
        <View style={st.iconCircle}>
          {step === 'create' ? (
            <KeyRound size={32} color="#FFF" />
          ) : (
            <Check size={32} color="#FFF" />
          )}
        </View>
        <Text style={st.title}>
          {step === 'create' ? 'Create Your PIN' : 'Confirm Your PIN'}
        </Text>
        <Text style={st.subtitle}>
          {step === 'create'
            ? 'Set a 4-digit PIN to secure your medical data'
            : 'Re-enter the same PIN to confirm'}
        </Text>

        <View style={st.stepIndicator}>
          <View style={[st.stepDot, st.stepActive]} />
          <View style={[st.stepLine, step === 'confirm' && st.stepLineActive]} />
          <View style={[st.stepDot, step === 'confirm' && st.stepActive]} />
        </View>

        {renderDots()}
        {error ? <Text style={st.error}>{error}</Text> : null}
      </View>

      {renderKeypad()}

      <View style={st.footer}>
        <Shield size={12} color={theme.textSecondary} />
        <Text style={st.footerText}>PIN is stored securely on your device</Text>
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
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSizes.xxl, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  subtitle: {
    fontSize: FontSizes.base, color: theme.textSecondary, marginTop: 6,
    textAlign: 'center', paddingHorizontal: Spacing.lg,
  },
  stepIndicator: {
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xl,
  },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: theme.border,
  },
  stepActive: { backgroundColor: '#059669' },
  stepLine: { width: 40, height: 2, backgroundColor: theme.border },
  stepLineActive: { backgroundColor: '#059669' },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: theme.border, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#059669', borderColor: '#059669' },
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
