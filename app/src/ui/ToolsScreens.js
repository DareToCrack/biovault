/**
 * Generator, Health and Settings screens.
 *
 * Generator: length + character sets, strength meter, copy.
 * Health: vault health summary with weak / reused / stale lists.
 * Settings: biometric toggle, change master password, encrypted
 * backup export/import, lock now, about.
 */
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from './theme';
import { analysePassword, isStale, STALE_AFTER_DAYS } from '../vault/health';
import { generatePassword, scorePassword, DEFAULT_OPTIONS } from '../vault/generator';
import {
  Card,
  DangerButton,
  ErrorBox,
  Field,
  NoteBox,
  Pill,
  PrimaryButton,
  SecondaryButton,
  StrengthBar,
} from './components';
import { copyWithAutoClear } from './VaultScreens';

function Toggle({ label, value, onPress, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <Text style={[styles.toggleText, value && styles.toggleTextOn]}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function GeneratorScreen({ onUsePassword, testID }) {
  const [length, setLength] = useState(DEFAULT_OPTIONS.length);
  const [lowercase, setLowercase] = useState(true);
  const [uppercase, setUppercase] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const strength = useMemo(() => scorePassword(password), [password]);

  const generate = () => {
    setError('');
    setCopied(false);
    try {
      setPassword(generatePassword({ length, lowercase, uppercase, digits, symbols }));
    } catch (e) {
      setError(e.message);
    }
  };

  const copy = async () => {
    if (!password) return;
    await copyWithAutoClear(password, () => setCopied(false));
    setCopied(true);
  };

  return (
    <View style={styles.screen} testID={testID || 'generator-screen'}>
      <Text style={styles.title}>Password generator</Text>
      <Text style={styles.subtitle}>Random passwords from your device's secure random generator — nothing leaves the device.</Text>
      <Card>
        <Text style={styles.fieldLabel}>Length: {length} characters</Text>
        <View style={styles.lengthRow}>
          {[12, 16, 20, 24, 32].map((n) => (
            <TouchableOpacity key={n} testID={`length-${n}`} onPress={() => setLength(n)} style={[styles.lengthBtn, length === n && styles.lengthBtnOn]}>
              <Text style={[styles.lengthBtnText, length === n && styles.lengthBtnTextOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Toggle label="Lowercase (a–z)" value={lowercase} onPress={() => setLowercase(!lowercase)} testID="gen-lower" />
        <Toggle label="Uppercase (A–Z)" value={uppercase} onPress={() => setUppercase(!uppercase)} testID="gen-upper" />
        <Toggle label="Digits (0–9)" value={digits} onPress={() => setDigits(!digits)} testID="gen-digits" />
        <Toggle label="Symbols (!@#$…)" value={symbols} onPress={() => setSymbols(!symbols)} testID="gen-symbols" />
        <View style={{ height: 12 }} />
        <PrimaryButton title="Generate password" onPress={generate} testID="gen-generate" />
        <ErrorBox message={error} />
        {password ? (
          <View style={{ marginTop: 12 }}>
            <View style={styles.generatedBox} testID="gen-result">
              <Text style={styles.generatedText} selectable>{password}</Text>
            </View>
            <View style={{ height: 10 }} />
            <StrengthBar score={strength.score} label={strength.label} testID="gen-strength" />
            <View style={{ height: 12 }} />
            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <PrimaryButton title={copied ? 'Copied — clears in 30s' : 'Copy'} onPress={copy} testID="gen-copy" />
              </View>
              <View style={styles.buttonHalf}>
                <SecondaryButton title="Use in a new entry" onPress={() => onUsePassword && onUsePassword(password)} testID="gen-use" />
              </View>
            </View>
          </View>
        ) : null}
      </Card>
      <NoteBox>Generated passwords are never saved automatically — copy one or use it in a new entry.</NoteBox>
    </View>
  );
}

export function HealthScreen({ entries, health, onOpenEntry, testID }) {
  const weak = useMemo(() => entries.filter((e) => analysePassword(e.password).weak), [entries]);
  const reusedIds = useMemo(() => new Set((health?.reusedGroups || []).flatMap((g) => g.entryIds)), [health]);
  const reused = useMemo(() => entries.filter((e) => reusedIds.has(e.id)), [entries, reusedIds]);
  const stale = useMemo(() => entries.filter((e) => isStale(e)), [entries]);

  const Row = ({ entry, tag, tone }) => (
    <TouchableOpacity onPress={() => onOpenEntry(entry)} testID={`health-${entry.id}`} activeOpacity={0.7}>
      <View style={styles.healthRowItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.healthEntryName}>{entry.name}</Text>
          <Text style={styles.healthEntryUser}>{entry.username}</Text>
        </View>
        <Pill text={tag} tone={tone} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.screen} testID={testID || 'health-screen'}>
      <Text style={styles.title}>Vault health</Text>
      <Card testID="health-summary">
        <Text style={styles.healthScore}>{health ? `${health.score}/100` : '—'}</Text>
        <Text style={styles.healthLabel}>
          {health ? `${health.weakCount} weak · ${health.reusedCount} reused · ${health.staleCount} stale out of ${health.total} entries` : 'Analysing…'}
        </Text>
        <Text style={styles.healthNote}>
          All analysis runs on your device. No password is ever sent anywhere — reuse is checked by comparing
          hashes, and weak means "in the common-password list, under 10 characters, or low strength".
        </Text>
      </Card>
      <Text style={styles.sectionTitle}>Weak passwords ({weak.length})</Text>
      <Card>
        {weak.length === 0 ? <Text style={styles.okText}>✓ No weak passwords.</Text> : weak.map((e) => (
          <Row key={e.id} entry={e} tag="Weak" tone="danger" />
        ))}
      </Card>
      <Text style={styles.sectionTitle}>Reused passwords ({reused.length})</Text>
      <Card>
        {reused.length === 0 ? <Text style={styles.okText}>✓ No password is used twice.</Text> : reused.map((e) => (
          <Row key={e.id} entry={e} tag="Reused" tone="warning" />
        ))}
      </Card>
      <Text style={styles.sectionTitle}>Stale passwords — unchanged for {STALE_AFTER_DAYS}+ days ({stale.length})</Text>
      <Card>
        {stale.length === 0 ? <Text style={styles.okText}>✓ Every password was changed recently.</Text> : stale.map((e) => (
          <Row key={e.id} entry={e} tag="Stale" tone="warning" />
        ))}
      </Card>
    </ScrollView>
  );
}

export function SettingsScreen({
  biometricStatus,
  biometricEnabled,
  onToggleBiometric,
  onChangeMasterPassword,
  onExportBackup,
  onImportBackup,
  onLockNow,
  onEraseVault,
  isDemo,
  testID,
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const changePassword = async () => {
    setError('');
    setMessage('');
    if (!oldPassword || !newPassword) return setError('Enter the current and the new master password.');
    if (newPassword !== confirm) return setError('New passwords do not match.');
    try {
      await onChangeMasterPassword(oldPassword, newPassword);
      setMessage('Master password changed.');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (e) {
      setError(e.message || 'Could not change the master password.');
    }
  };

  return (
    <ScrollView style={styles.screen} testID={testID || 'settings-screen'}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Unlock</Text>
      <Card>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingName}>Biometric unlock</Text>
            <Text style={styles.settingDesc}>
              {biometricStatus?.available
                ? `Unlock with ${biometricStatus.label || 'fingerprint / face'} after the first master-password unlock.`
                : biometricStatus?.reason || 'Biometrics are not available on this device.'}
              {Platform.OS === 'web' ? ' (Not available on web — master password only.)' : ''}
            </Text>
          </View>
          <TouchableOpacity
            testID="settings-biometric-toggle"
            onPress={onToggleBiometric}
            disabled={!biometricStatus?.available || isDemo}
            style={[styles.toggle, biometricEnabled && styles.toggleOn, (!biometricStatus?.available || isDemo) && styles.toggleDisabled]}
          >
            <Text style={[styles.toggleText, biometricEnabled && styles.toggleTextOn]}>{biometricEnabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Change master password</Text>
      <Card>
        <Field label="Current master password" value={oldPassword} onChangeText={setOldPassword} secureTextEntry testID="settings-old-password" />
        <Field label="New master password" value={newPassword} onChangeText={setNewPassword} secureTextEntry testID="settings-new-password" />
        <Field label="Confirm new master password" value={confirm} onChangeText={setConfirm} secureTextEntry testID="settings-confirm-password" />
        <ErrorBox message={error} />
        {message ? <Text style={styles.okText}>{message}</Text> : null}
        <PrimaryButton title="Change master password" onPress={changePassword} disabled={isDemo} testID="settings-change-password" />
        {isDemo ? <Text style={styles.settingDesc}>Disabled in the demo vault.</Text> : null}
      </Card>

      <Text style={styles.sectionTitle}>Encrypted backup</Text>
      <Card>
        <Text style={styles.settingDesc}>
          Export the whole vault as one encrypted file (AES-256-GCM, unlocked with your master password).
          Import restores it on this or another device. The backup file is useless without the master password.
        </Text>
        <View style={{ height: 10 }} />
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <PrimaryButton title="Export backup" onPress={onExportBackup} testID="settings-export" />
          </View>
          <View style={styles.buttonHalf}>
            <SecondaryButton title="Import backup" onPress={onImportBackup} testID="settings-import" />
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Session</Text>
      <Card>
        <SecondaryButton title="Lock vault now" onPress={onLockNow} testID="settings-lock-now" />
        <View style={{ height: 10 }} />
        <Text style={styles.settingDesc}>
          The vault also locks itself after 2 minutes without use, and whenever the app goes to the background.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Danger zone</Text>
      <Card>
        <DangerButton title="Erase vault (deletes everything)" onPress={onEraseVault} testID="settings-erase" />
        <View style={{ height: 8 }} />
        <Text style={styles.settingDesc}>This deletes every entry, the salt and the wrapped key. There is no recovery.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21, marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6, marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  lengthRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  lengthBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  lengthBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  lengthBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  lengthBtnTextOn: { color: '#ffffff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleLabel: { fontSize: 15, color: colors.text },
  toggle: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleDisabled: { opacity: 0.5 },
  toggleText: { fontSize: 12, fontWeight: '800', color: colors.muted },
  toggleTextOn: { color: '#ffffff' },
  generatedBox: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14 },
  generatedText: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  buttonHalf: { flex: 1 },
  healthScore: { fontSize: 34, fontWeight: '800', color: colors.primary },
  healthLabel: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  healthNote: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 19 },
  healthRowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  healthEntryName: { fontSize: 15, fontWeight: '700', color: colors.text },
  healthEntryUser: { fontSize: 13, color: colors.muted, marginTop: 2 },
  okText: { fontSize: 14, color: colors.successText, lineHeight: 20 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingName: { fontSize: 15, fontWeight: '700', color: colors.text },
  settingDesc: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
});
