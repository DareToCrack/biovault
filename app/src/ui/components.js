/**
 * Shared UI components — small, plain, light palette.
 * No navigation library: screens are switched by the App state machine.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from './theme';

export function PrimaryButton({ title, onPress, disabled, testID, style }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.disabledButton, style]}
      activeOpacity={0.8}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, disabled, testID, style }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled && styles.disabledButton, style]}
      activeOpacity={0.8}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function DangerButton({ title, onPress, testID, style }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.dangerButton, style]}
      activeOpacity={0.8}
    >
      <Text style={styles.dangerButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Card({ children, style, testID }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, testID, autoCapitalize = 'none', keyboardType = 'default', editable = true }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        editable={editable}
      />
    </View>
  );
}

export function Pill({ text, tone = 'info', testID }) {
  const tones = {
    info: { bg: colors.infoBg, fg: colors.infoText },
    success: { bg: colors.successBg, fg: colors.successText },
    warning: { bg: colors.warningBg, fg: colors.warningText },
    danger: { bg: colors.dangerBg, fg: colors.dangerText },
  };
  const t = tones[tone] || tones.info;
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function StrengthBar({ score, label, testID }) {
  const pct = Math.max(2, Math.min(100, score));
  const color = score < 30 ? colors.dangerText : score < 55 ? colors.warningText : score < 80 ? colors.successText : colors.primary;
  return (
    <View testID={testID}>
      <View style={styles.strengthTrack}>
        <View style={[styles.strengthFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.strengthLabel, { color }]}>{label} — {score}/100</Text>
    </View>
  );
}

export function Loading({ label }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} testID="error-box">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function NoteBox({ children }) {
  return (
    <View style={styles.noteBox}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  dangerButton: {
    backgroundColor: colors.dangerBg,
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  dangerButtonText: { color: colors.dangerText, fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputDisabled: { backgroundColor: colors.bg, color: colors.muted },
  pill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  strengthTrack: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
  strengthFill: { height: 8, borderRadius: 999 },
  strengthLabel: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: colors.muted, fontSize: 14 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: colors.dangerText, fontSize: 14, lineHeight: 20 },
  noteBox: { backgroundColor: colors.infoBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  noteText: { color: colors.infoText, fontSize: 13, lineHeight: 19 },
});
