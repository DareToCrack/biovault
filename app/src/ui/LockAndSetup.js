/**
 * Setup + Lock screens.
 *
 * Setup: create the master password (strength meter, confirm field).
 * The master password is never stored — only a PBKDF2 verification hash.
 *
 * Lock: unlock with the master password, or with biometrics when enabled.
 * On web there are no biometrics, so the demo offers a "simulate
 * biometric unlock" button instead.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';
import {
  Card,
  ErrorBox,
  Field,
  NoteBox,
  PrimaryButton,
  SecondaryButton,
  StrengthBar,
} from './components';
import { scoreMasterPassword } from '../vault/generator';

export function SetupScreen({ onSetup, busy }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const strength = scoreMasterPassword(password);

  const submit = () => {
    setError('');
    if (password.length < 8) return setError('Master password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (strength.score < 30) {
      return setError('That master password is too weak — use a longer mix of letters, numbers and symbols.');
    }
    onSetup(password);
  };

  return (
    <View style={styles.screen} testID="setup-screen">
      <Text style={styles.title}>Create your vault</Text>
      <Text style={styles.subtitle}>
        One master password protects everything. It is never stored — only a verification hash is kept,
        so if you forget it, the vault cannot be recovered.
      </Text>
      <Card>
        <Field
          label="Master password"
          value={password}
          onChangeText={setPassword}
          placeholder="A long, strong password"
          secureTextEntry
          testID="setup-password"
        />
        {password.length > 0 ? <StrengthBar score={strength.score} label={strength.label} testID="setup-strength" /> : null}
        <View style={{ height: 12 }} />
        <Field
          label="Confirm master password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Type it again"
          secureTextEntry
          testID="setup-confirm"
        />
        <ErrorBox message={error} />
        <PrimaryButton title={busy ? 'Creating vault…' : 'Create vault'} onPress={submit} disabled={busy} testID="setup-create" />
      </Card>
      <NoteBox>
        Your vault key is derived from this password with PBKDF2-SHA-256 (600,000 iterations). Every stored
        password is encrypted with AES-256-GCM and never leaves your device.
      </NoteBox>
    </View>
  );
}

export function LockScreen({
  biometricLabel,
  biometricAvailable,
  onUnlockPassword,
  onUnlockBiometric,
  onDemo,
  onSimulateBiometric,
  busy,
  demoMode,
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    if (!password) return setError('Enter your master password.');
    onUnlockPassword(password, (err) => setError(err));
  };

  return (
    <View style={styles.screen} testID="lock-screen">
      <View style={styles.lockIcon}>
        <Text style={styles.lockIconText}>🔒</Text>
      </View>
      <Text style={styles.title}>BioVault</Text>
      <Text style={styles.subtitle}>Biometric Password Vault — local only, no cloud, no tracking.</Text>

      <Card>
        <Field
          label="Master password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your master password"
          secureTextEntry
          testID="lock-password"
        />
        <ErrorBox message={error} />
        <PrimaryButton title={busy ? 'Unlocking…' : 'Unlock with master password'} onPress={submit} disabled={busy} testID="lock-unlock" />
        {biometricAvailable ? (
          <View style={{ marginTop: 10 }}>
            <SecondaryButton
              title={`Unlock with ${biometricLabel}`}
              onPress={onUnlockBiometric}
              testID="lock-biometric"
            />
          </View>
        ) : null}
        {demoMode || !biometricAvailable ? (
          <View style={{ marginTop: 10 }}>
            <SecondaryButton
              title="Simulate biometric unlock (demo)"
              onPress={onSimulateBiometric}
              testID="lock-simulate-biometric"
            />
          </View>
        ) : null}
      </Card>

      <SecondaryButton title="Explore demo vault" onPress={onDemo} testID="lock-demo" />
      <View style={{ height: 12 }} />
      <NoteBox>
        Demo vault: 8 fictional entries (Gmail, GitHub, LinkedIn, Netflix, Amazon, Wi-Fi, Bank, VPN) —
        one weak password, one reused pair, one stale password. Nothing you do in the demo is stored.
      </NoteBox>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21, marginBottom: 18 },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockIconText: { fontSize: 34 },
});
