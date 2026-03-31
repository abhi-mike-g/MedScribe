/**
 * SecuritySyncSettings — Shared section for both doctor and patient settings.
 * Shows: PIN management, biometric toggle, sync status, device list.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, Alert, TextInput,
  ActivityIndicator, Modal, Platform,
} from 'react-native';
import { theme, Spacing, FontSizes } from '../constants/theme';
import { useLock } from '../context/LockContext';
import { useSync } from '../context/SyncContext';
import {
  Lock, Fingerprint, ScanFace, Key, RefreshCw, Smartphone, Trash2,
  Cloud, CloudOff, Check, ChevronRight, Shield, MonitorSmartphone,
} from 'lucide-react-native';

export default function SecuritySyncSettings() {
  const {
    hasPinSetup, biometricEnabled, biometricAvailable, biometricType,
    toggleBiometric, changePin,
  } = useLock();
  const {
    last_sync, syncing, devices, deviceId, syncNow, removeDevice, syncStatus,
  } = useSync();
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    const success = await toggleBiometric(value);
    if (!success && value) {
      Alert.alert('Biometric Failed', 'Could not enable biometric authentication. Please try again.');
    }
  }, [toggleBiometric]);

  const handleChangePin = useCallback(async () => {
    setPinError('');
    if (oldPin.length !== 4) { setPinError('Current PIN must be 4 digits'); return; }
    if (newPin.length !== 4) { setPinError('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin) { setPinError('New PINs do not match'); return; }
    if (oldPin === newPin) { setPinError('New PIN must be different'); return; }

    setChangingPin(true);
    const success = await changePin(oldPin, newPin);
    setChangingPin(false);

    if (success) {
      Alert.alert('Success', 'PIN changed successfully');
      setShowChangePin(false);
      setOldPin(''); setNewPin(''); setConfirmPin('');
    } else {
      setPinError('Current PIN is incorrect');
    }
  }, [oldPin, newPin, confirmPin, changePin]);

  const handleRemoveDevice = useCallback(async (devId: string, devName: string) => {
    Alert.alert(
      'Remove Device',
      `Remove "${devName}" from your sync list? This device will need to re-register on next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await removeDevice(devId);
            if (ok) Alert.alert('Removed', 'Device removed successfully');
          },
        },
      ]
    );
  }, [removeDevice]);

  const formatSyncTime = (ts: string | null) => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const BiometricIcon = biometricType === 'Face ID' ? ScanFace : Fingerprint;

  return (
    <View>
      {/* ============ APP SECURITY ============ */}
      <Text style={st.sectionLabel}>APP SECURITY</Text>
      <View style={st.card}>
        {/* PIN Status */}
        <View style={st.row}>
          <Lock size={16} color={hasPinSetup ? '#10B981' : theme.textSecondary} />
          <Text style={st.rowLabel}>PIN Lock</Text>
          <View style={[st.statusPill, hasPinSetup ? st.statusActive : st.statusInactive]}>
            <Text style={[st.statusText, hasPinSetup ? st.statusTextActive : st.statusTextInactive]}>
              {hasPinSetup ? 'Active' : 'Not Set'}
            </Text>
          </View>
        </View>

        {/* Change PIN */}
        {hasPinSetup && (
          <TouchableOpacity style={st.row} onPress={() => setShowChangePin(true)} activeOpacity={0.6}>
            <Key size={16} color={theme.textSecondary} />
            <Text style={st.rowLabel}>Change PIN</Text>
            <ChevronRight size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Biometric Toggle */}
        {biometricAvailable && hasPinSetup && (
          <View style={st.row}>
            <BiometricIcon size={16} color={biometricEnabled ? '#0033A0' : theme.textSecondary} />
            <Text style={st.rowLabel}>{biometricType}</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: theme.border, true: '#93C5FD' }}
              thumbColor={biometricEnabled ? '#0033A0' : '#f4f3f4'}
            />
          </View>
        )}

        {!biometricAvailable && hasPinSetup && (
          <View style={st.row}>
            <Fingerprint size={16} color={theme.textSecondary} />
            <Text style={[st.rowLabel, { color: theme.textSecondary }]}>Biometric not available on this device</Text>
          </View>
        )}

        {/* Encryption Badge */}
        <View style={st.row}>
          <Shield size={16} color="#10B981" />
          <Text style={st.rowLabel}>Encryption</Text>
          <Text style={[st.rowValue, { color: '#10B981' }]}>AES-256-GCM</Text>
        </View>
      </View>

      {/* ============ CLOUD SYNC ============ */}
      <Text style={st.sectionLabel}>CLOUD SYNC</Text>
      <View style={st.card}>
        {/* Sync Status */}
        <View style={st.row}>
          {syncStatus === 'syncing' ? (
            <ActivityIndicator size="small" color="#0033A0" />
          ) : syncStatus === 'success' ? (
            <Cloud size={16} color="#10B981" />
          ) : syncStatus === 'error' ? (
            <CloudOff size={16} color={theme.error} />
          ) : (
            <Cloud size={16} color={theme.textSecondary} />
          )}
          <Text style={st.rowLabel}>Sync Status</Text>
          <Text style={st.rowValue}>{formatSyncTime(last_sync)}</Text>
        </View>

        {/* Manual Sync */}
        <TouchableOpacity
          style={st.row}
          onPress={syncNow}
          disabled={syncing}
          activeOpacity={0.6}
        >
          <RefreshCw size={16} color={syncing ? theme.textSecondary : '#0033A0'} />
          <Text style={[st.rowLabel, syncing && { color: theme.textSecondary }]}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Text>
          {syncing && <ActivityIndicator size="small" color="#0033A0" />}
        </TouchableOpacity>

        {/* Device Count */}
        <View style={st.row}>
          <MonitorSmartphone size={16} color={theme.textSecondary} />
          <Text style={st.rowLabel}>Linked Devices</Text>
          <Text style={st.rowValue}>{devices.length}</Text>
        </View>
      </View>

      {/* ============ DEVICES LIST ============ */}
      {devices.length > 0 && (
        <>
          <Text style={st.sectionLabel}>LINKED DEVICES</Text>
          <View style={st.card}>
            {devices.map((device, i) => (
              <View key={device.id || i} style={st.deviceRow}>
                <View style={st.deviceIcon}>
                  <Smartphone size={18} color={device.is_current ? '#0033A0' : theme.textSecondary} />
                </View>
                <View style={st.deviceInfo}>
                  <View style={st.deviceNameRow}>
                    <Text style={st.deviceName}>{device.device_name || device.name || 'Unknown'}</Text>
                    {device.is_current && (
                      <View style={st.currentBadge}>
                        <Text style={st.currentText}>This device</Text>
                      </View>
                    )}
                  </View>
                  <Text style={st.deviceMeta}>
                    {device.platform} {'\u2022'} Last seen: {formatSyncTime(device.last_seen || device.last_sync)}
                  </Text>
                </View>
                {!device.is_current && (
                  <TouchableOpacity
                    style={st.removeBtn}
                    onPress={() => handleRemoveDevice(device.id, device.device_name || device.name || 'Unknown')}
                    activeOpacity={0.6}
                  >
                    <Trash2 size={16} color={theme.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* ============ CHANGE PIN MODAL ============ */}
      <Modal visible={showChangePin} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Change PIN</Text>

            <Text style={st.inputLabel}>Current PIN</Text>
            <TextInput
              style={st.pinInput}
              value={oldPin}
              onChangeText={setOldPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="Enter current 4-digit PIN"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={st.inputLabel}>New PIN</Text>
            <TextInput
              style={st.pinInput}
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="Enter new 4-digit PIN"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={st.inputLabel}>Confirm New PIN</Text>
            <TextInput
              style={st.pinInput}
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="Re-enter new PIN"
              placeholderTextColor={theme.textSecondary}
            />

            {pinError ? <Text style={st.pinError}>{pinError}</Text> : null}

            <View style={st.modalButtons}>
              <TouchableOpacity
                style={st.modalCancel}
                onPress={() => { setShowChangePin(false); setOldPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); }}
              >
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.modalConfirm}
                onPress={handleChangePin}
                disabled={changingPin}
              >
                {changingPin ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={st.modalConfirmText}>Change PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  sectionLabel: { fontSize: FontSizes.xs, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginBottom: Spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowLabel: { flex: 1, fontSize: FontSizes.md, color: theme.textPrimary },
  rowValue: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  statusActive: { backgroundColor: '#052E16' },
  statusInactive: { backgroundColor: theme.inputBg },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  statusTextActive: { color: '#10B981' },
  statusTextInactive: { color: theme.textSecondary },
  deviceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.border },
  deviceIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1 },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceName: { fontSize: FontSizes.md, fontWeight: '600', color: theme.textPrimary },
  currentBadge: { backgroundColor: '#E8EEFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  currentText: { fontSize: 9, color: '#0033A0', fontWeight: '700' },
  deviceMeta: { fontSize: FontSizes.xs, color: theme.textSecondary, marginTop: 2 },
  removeBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  modalContent: { backgroundColor: theme.background, borderRadius: 16, padding: Spacing.xl },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: theme.textPrimary, marginBottom: Spacing.lg },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textSecondary, marginBottom: 4, marginTop: Spacing.sm },
  pinInput: {
    backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, paddingHorizontal: Spacing.base, paddingVertical: 12,
    fontSize: FontSizes.base, color: theme.textPrimary, letterSpacing: 8, textAlign: 'center',
  },
  pinError: { color: theme.error, fontSize: FontSizes.sm, fontWeight: '600', marginTop: Spacing.sm },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  modalCancel: { flex: 1, height: 48, borderRadius: 9999, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textSecondary },
  modalConfirm: { flex: 1, height: 48, borderRadius: 9999, backgroundColor: '#0033A0', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: FontSizes.base, fontWeight: '700', color: '#FFF' },
});
