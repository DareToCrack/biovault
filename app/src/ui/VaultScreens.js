/**
 * Vault list + entry detail / add / edit screens.
 *
 * The list shows decrypted entries held in memory (the vault is unlocked).
 * Passwords are masked until revealed, and copying auto-clears the
 * clipboard after 30 seconds.
 */
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from './theme';
import { CATEGORIES } from '../vault/store';
import { analysePassword } from '../vault/health';
import {
  Card,
  DangerButton,
  ErrorBox,
  Field,
  NoteBox,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from './components';

export const CLIPBOARD_CLEAR_AFTER_MS = 30000;

/** Copy text, then replace the clipboard with an empty string after 30s. */
export async function copyWithAutoClear(text, onCleared) {
  await Clipboard.setStringAsync(text);
  setTimeout(async () => {
    try {
      await Clipboard.setStringAsync('');
      if (onCleared) onCleared();
    } catch {
      // Clipboard clear is best-effort.
    }
  }, CLIPBOARD_CLEAR_AFTER_MS);
}

function CategoryChip({ label, selected, onPress, testID }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function VaultScreen({ entries, health, onOpenEntry, onAddEntry, testID }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== 'All' && e.category !== category) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        (e.url || '').toLowerCase().includes(q)
      );
    });
  }, [entries, query, category]);

  return (
    <View style={styles.screen} testID={testID || 'vault-screen'}>
      <Card testID="health-summary">
        <View style={styles.healthRow}>
          <View>
            <Text style={styles.healthScore}>{health ? `${health.score}/100` : '—'}</Text>
            <Text style={styles.healthLabel}>Vault health</Text>
          </View>
          <View style={styles.healthCounts}>
            <Text style={styles.healthCountText}>
              {health ? `${health.weakCount} weak · ${health.reusedCount} reused · ${health.staleCount} stale` : 'Analysing…'}
            </Text>
            <Text style={styles.healthSub}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</Text>
          </View>
        </View>
      </Card>

      <TextInput
        testID="vault-search"
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name, username or site…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {['All', ...CATEGORIES].map((c) => (
          <CategoryChip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`chip-${c}`} />
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptyText}>
            {entries.length === 0
              ? 'Add your first password with the button below.'
              : 'Nothing matches that search or category.'}
          </Text>
        </Card>
      ) : (
        filtered.map((entry) => (
          <TouchableOpacity key={entry.id} onPress={() => onOpenEntry(entry)} testID={`entry-${entry.id}`} activeOpacity={0.7}>
            <Card style={styles.entryCard}>
              <View style={styles.entryRow}>
                <View style={[styles.avatar, { backgroundColor: colors.category[entry.category] || colors.category.Other }]}>
                  <Text style={styles.avatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.entryMain}>
                  <Text style={styles.entryName}>
                    {entry.favourite ? '★ ' : ''}{entry.name}
                  </Text>
                  <Text style={styles.entryUser} numberOfLines={1}>{entry.username}</Text>
                </View>
                <Pill text={entry.category} tone="info" />
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <PrimaryButton title="+ Add entry" onPress={onAddEntry} testID="vault-add" />
    </View>
  );
}

export function EntryScreen({ entry, prefillPassword, onSave, onDelete, onBack, isNew, testID }) {
  const [editing, setEditing] = useState(isNew);
  const [name, setName] = useState(entry?.name || '');
  const [username, setUsername] = useState(entry?.username || '');
  const [password, setPassword] = useState(entry?.password || prefillPassword || '');
  const [url, setUrl] = useState(entry?.url || '');
  const [category, setCategory] = useState(entry?.category || 'Other');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [favourite, setFavourite] = useState(Boolean(entry?.favourite));
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const analysis = useMemo(() => analysePassword(password), [password]);

  const save = () => {
    setError('');
    if (!name.trim()) return setError('Site / app name is required.');
    if (!password) return setError('Password is required.');
    onSave({ name: name.trim(), username, password, url, category, notes, favourite });
  };

  const copyPassword = async () => {
    await copyWithAutoClear(password, () => setCopied(false));
    setCopied(true);
  };

  if (!editing && entry) {
    return (
      <View style={styles.screen} testID={testID || 'entry-screen'}>
        <SecondaryButton title="← Back to vault" onPress={onBack} testID="entry-back" />
        <View style={{ height: 12 }} />
        <Card>
          <View style={styles.detailHeader}>
            <View style={[styles.avatar, styles.avatarLarge, { backgroundColor: colors.category[entry.category] || colors.category.Other }]}>
              <Text style={[styles.avatarText, styles.avatarTextLarge]}>{entry.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.detailName}>{entry.favourite ? '★ ' : ''}{entry.name}</Text>
              <Pill text={entry.category} tone="info" />
            </View>
          </View>
          <DetailRow label="Username" value={entry.username || '—'} />
          <DetailRow label="Password" value={showPassword ? entry.password : '•'.repeat(Math.min(12, entry.password.length))} />
          <DetailRow label="Website" value={entry.url || '—'} />
          {entry.notes ? <DetailRow label="Notes" value={entry.notes} /> : null}
          <Text style={styles.metaText}>
            Created {new Date(entry.createdAt).toLocaleDateString()} · Password changed{' '}
            {new Date(entry.passwordChangedAt || entry.updatedAt).toLocaleDateString()}
          </Text>
          {analysis.weak ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>⚠ Weak password: {analysis.reasons.join('; ')}.</Text>
            </View>
          ) : null}
        </Card>
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <SecondaryButton title={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} testID="entry-show" />
          </View>
          <View style={styles.buttonHalf}>
            <PrimaryButton title={copied ? 'Copied — clears in 30s' : 'Copy password'} onPress={copyPassword} testID="entry-copy" />
          </View>
        </View>
        <View style={{ height: 10 }} />
        <SecondaryButton title="Edit entry" onPress={() => setEditing(true)} testID="entry-edit" />
        <View style={{ height: 10 }} />
        {confirmDelete ? (
          <DangerButton title="Tap again to confirm delete" onPress={onDelete} testID="entry-delete-confirm" />
        ) : (
          <DangerButton title="Delete entry" onPress={() => setConfirmDelete(true)} testID="entry-delete" />
        )}
        <NoteBox>Copying clears the clipboard automatically after 30 seconds.</NoteBox>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID={testID || 'entry-edit-screen'}>
      <SecondaryButton title="← Back" onPress={onBack} testID="entry-edit-back" />
      <View style={{ height: 12 }} />
      <Text style={styles.title}>{isNew ? 'Add entry' : 'Edit entry'}</Text>
      <Card>
        <Field label="Site / app name" value={name} onChangeText={setName} placeholder="e.g. Gmail" testID="entry-name" />
        <Field label="Username / email" value={username} onChangeText={setUsername} placeholder="you@example.com" testID="entry-username" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} testID="entry-password" />
        <SecondaryButton title={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} testID="entry-edit-show" />
        <View style={{ height: 12 }} />
        <Field label="Website (optional)" value={url} onChangeText={setUrl} placeholder="https://…" testID="entry-url" autoCapitalize="none" />
        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {CATEGORIES.map((c) => (
            <CategoryChip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`cat-${c}`} />
          ))}
        </ScrollView>
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything to remember" testID="entry-notes" />
        <TouchableOpacity onPress={() => setFavourite(!favourite)} testID="entry-favourite" style={styles.favRow}>
          <Text style={styles.favText}>{favourite ? '★ Favourite' : '☆ Mark as favourite'}</Text>
        </TouchableOpacity>
        {analysis.weak && password ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>⚠ Weak password: {analysis.reasons.join('; ')}.</Text>
          </View>
        ) : null}
        <ErrorBox message={error} />
        <PrimaryButton title={isNew ? 'Save entry' : 'Save changes'} onPress={save} testID="entry-save" />
      </Card>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthScore: { fontSize: 34, fontWeight: '800', color: colors.primary },
  healthLabel: { fontSize: 13, color: colors.muted, marginTop: 2 },
  healthCounts: { alignItems: 'flex-end' },
  healthCountText: { fontSize: 14, fontWeight: '600', color: colors.text },
  healthSub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 10,
  },
  chips: { marginBottom: 12, flexGrow: 0 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
    marginRight: 8,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: '#ffffff' },
  entryCard: { paddingVertical: 12, marginBottom: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarLarge: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  avatarTextLarge: { fontSize: 24 },
  entryMain: { flex: 1 },
  entryName: { fontSize: 16, fontWeight: '700', color: colors.text },
  entryUser: { fontSize: 13, color: colors.muted, marginTop: 2 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailName: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 6 },
  detailRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  detailLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 16, color: colors.text, marginTop: 3 },
  metaText: { fontSize: 12, color: colors.muted, marginTop: 10, lineHeight: 17 },
  warnBox: { backgroundColor: colors.warningBg, borderRadius: 10, padding: 12, marginTop: 12 },
  warnText: { color: colors.warningText, fontSize: 14, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  buttonHalf: { flex: 1 },
  favRow: { paddingVertical: 8, marginBottom: 8 },
  favText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
