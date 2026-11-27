/**
 * BioVault — Biometric Password Vault.
 *
 * State machine: loading → setup → locked → unlocked (tabs: Vault,
 * Generator, Health, Settings). Demo mode runs a separate in-memory
 * vault with fictional entries, so the whole UI is explorable without
 * a device. On web, `?demo=vault|entry|generator|lock` deep-links
 * straight into the demo for screenshots and previews.
 *
 * Auto-lock: 2 minutes without use, or immediately when the app goes
 * to the background. Locking clears the vault key and decrypted entries
 * from memory.
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from './src/ui/theme';
import { MemoryAdapter } from './src/vault/adapters';
import { SQLiteAdapter } from './src/vault/sqliteAdapter';
import { VaultStore } from './src/vault/store';
import { keyStore } from './src/vault/keyStore';
import {
  setupVault,
  unlockWithPassword,
  unlockWithBiometrics,
  enableBiometrics,
  disableBiometrics,
  isVaultSetup,
  isBiometricEnabled,
  changeMasterPassword,
} from './src/vault/keyring';
import { getBiometricStatus, authenticateWithBiometrics, biometricLabel } from './src/auth/biometric';
import { analyseVault } from './src/vault/health';
import { lockReducer } from './src/vault/lock';
import { DEMO_ENTRIES, DEMO_MASTER_PASSWORD } from './src/vault/demo';
import { encryptBackup, decryptBackup } from './src/crypto/core';
import { LockScreen, SetupScreen } from './src/ui/LockAndSetup';
import { VaultScreen, EntryScreen } from './src/ui/VaultScreens';
import { GeneratorScreen, HealthScreen, SettingsScreen } from './src/ui/ToolsScreens';
import { Loading, Pill } from './src/ui/components';

const TABS = [
  { id: 'vault', label: 'Vault', testID: 'tab-vault' },
  { id: 'generator', label: 'Generator', testID: 'tab-generator' },
  { id: 'health', label: 'Health', testID: 'tab-health' },
  { id: 'settings', label: 'Settings', testID: 'tab-settings' },
];

function getDemoRoute() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo');
  } catch {
    return null;
  }
}

function memoryKeyStore() {
  const map = new Map();
  return {
    async set(k, v) { map.set(k, v); },
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async delete(k) { map.delete(k); },
    async setAuth() { throw new Error('Biometric-gated storage is not available in the demo'); },
    async getAuth() { throw new Error('Biometric unlock is not available in the demo'); },
    async deleteAuth() {},
  };
}

export default function App() {
  const [phase, setPhase] = useState('loading'); // loading | setup | locked | unlocked
  const [isDemo, setIsDemo] = useState(false);
  const [adapter, setAdapter] = useState(null);
  const [store, setStore] = useState(null);
  const [kek, setKek] = useState(null);
  const [entries, setEntries] = useState([]);
  const [health, setHealth] = useState(null);
  const [tab, setTab] = useState('vault');
  const [selectedEntry, setSelectedEntry] = useState(null); // entry object | 'new' | null
  const [prefillPassword, setPrefillPassword] = useState('');
  const [biometricStatus, setBiometricStatus] = useState({ available: false, enrolled: false, types: [] });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [lock, dispatchLock] = useReducer(lockReducer, { status: 'locked', lastActivityAt: null });
  const demoRouteRef = useRef(getDemoRoute());
  // Raw vault key of the current session (in memory only). Needed to
  // enable biometric unlock; cleared on lock. Never persisted.
  const vaultKeyRawRef = useRef(null);

  const refreshEntries = useCallback(async (vaultStore) => {
    const list = await vaultStore.listEntries();
    setEntries(list);
    setHealth(await analyseVault(list));
  }, []);

  const lockVault = useCallback(() => {
    dispatchLock({ type: 'lock' });
    vaultKeyRawRef.current = null;
    setStore(null);
    setKek(null);
    setEntries([]);
    setHealth(null);
    setSelectedEntry(null);
    setTab('vault');
    setPhase('locked');
  }, []);

  // ---- initialisation -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ad;
      try {
        ad = new SQLiteAdapter();
        await ad.init();
      } catch (e) {
        // Web without SharedArrayBuffer support, or any SQLite failure:
        // fall back to an in-memory vault for this session (honest note).
        ad = new MemoryAdapter();
        await ad.init();
        if (!cancelled) setStorageNote('SQLite is unavailable in this browser — using an in-memory vault for this session. Entries will not persist after reload.');
      }
      if (cancelled) return;
      setAdapter(ad);
      const setup = await isVaultSetup(ad);
      const status = await getBiometricStatus({ authModule: LocalAuthentication, platformOs: Platform.OS });
      if (cancelled) return;
      setBiometricStatus({ ...status, label: biometricLabel(status.types) });
      if (setup) setBiometricEnabled(await isBiometricEnabled(ad));
      setPhase(setup ? 'locked' : 'setup');

      // Demo deep-links (web only): jump straight into the demo vault.
      const route = demoRouteRef.current;
      if (route && route !== 'lock' && route !== '1') {
        await enterDemo(route);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- auto-lock: inactivity timer + background ------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      if (phase === 'unlocked') dispatchLock({ type: 'check' });
    }, 10000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'unlocked' && lock.status === 'locked') lockVault();
  }, [lock.status, phase, lockVault]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && phase === 'unlocked') lockVault();
    });
    return () => sub.remove();
  }, [phase, lockVault]);

  // Web: any pointer/key activity refreshes the inactivity timer.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const bump = () => dispatchLock({ type: 'activity' });
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, []);

  // ---- vault operations ------------------------------------------------
  const enterDemo = useCallback(async (route) => {
    setBusy(true);
    try {
      const demoAdapter = new MemoryAdapter();
      await demoAdapter.init();
      const demoKeyStore = memoryKeyStore();
      const { kek: demoKek, vaultKey, vaultKeyRaw } = await setupVault(demoAdapter, demoKeyStore, DEMO_MASTER_PASSWORD);
      vaultKeyRawRef.current = vaultKeyRaw;
      const demoStore = new VaultStore(demoAdapter, vaultKey);
      await demoStore.replaceAll(DEMO_ENTRIES);
      setIsDemo(true);
      setAdapter(demoAdapter);
      setStore(demoStore);
      setKek(demoKek);
      await refreshEntries(demoStore);
      dispatchLock({ type: 'unlock' });
      setPhase('unlocked');
      if (route === 'generator') setTab('generator');
      else if (route === 'entry') {
        const list = await demoStore.listEntries();
        setSelectedEntry(list[0] || null);
        setTab('vault');
      } else {
        setTab('vault');
      }
    } finally {
      setBusy(false);
    }
  }, [refreshEntries]);

  const handleSetup = useCallback(async (masterPassword) => {
    if (!adapter) return;
    setBusy(true);
    try {
      const { kek: newKek, vaultKey, vaultKeyRaw } = await setupVault(adapter, keyStore, masterPassword);
      vaultKeyRawRef.current = vaultKeyRaw;
      const vaultStore = new VaultStore(adapter, vaultKey);
      setStore(vaultStore);
      setKek(newKek);
      setEntries([]);
      setHealth(await analyseVault([]));
      dispatchLock({ type: 'unlock' });
      setPhase('unlocked');
    } finally {
      setBusy(false);
    }
  }, [adapter]);

  const handleUnlockPassword = useCallback(async (masterPassword, onError) => {
    if (!adapter) return;
    setBusy(true);
    try {
      const { kek: newKek, vaultKey, vaultKeyRaw } = await unlockWithPassword(adapter, keyStore, masterPassword);
      vaultKeyRawRef.current = vaultKeyRaw;
      const vaultStore = new VaultStore(adapter, vaultKey);
      setStore(vaultStore);
      setKek(newKek);
      await refreshEntries(vaultStore);
      setBiometricEnabled(await isBiometricEnabled(adapter));
      dispatchLock({ type: 'unlock' });
      setPhase('unlocked');
    } catch (e) {
      if (onError) onError(e.message || 'Could not unlock the vault.');
    } finally {
      setBusy(false);
    }
  }, [adapter, refreshEntries]);

  const handleUnlockBiometric = useCallback(async () => {
    const auth = await authenticateWithBiometrics({ authModule: LocalAuthentication, platformOs: Platform.OS });
    if (!auth.success) {
      setNotice(`Biometric unlock failed: ${auth.error}. Use the master password.`);
      return;
    }
    try {
      const { vaultKey } = await unlockWithBiometrics(keyStore);
      const vaultStore = new VaultStore(adapter, vaultKey);
      setStore(vaultStore);
      await refreshEntries(vaultStore);
      dispatchLock({ type: 'unlock' });
      setPhase('unlocked');
    } catch (e) {
      setNotice(`${e.message || 'Biometric unlock failed.'} Use the master password.`);
    }
  }, [adapter, refreshEntries]);

  const handleSimulateBiometric = useCallback(async () => {
    // Demo / web path: no real biometrics — unlock the demo vault.
    await enterDemo('vault');
  }, [enterDemo]);

  const handleToggleBiometric = useCallback(async () => {
    if (!adapter || !store || isDemo) return;
    if (biometricEnabled) {
      await disableBiometrics(adapter, keyStore);
      setBiometricEnabled(false);
      setNotice('Biometric unlock disabled.');
      return;
    }
    const auth = await authenticateWithBiometrics({ authModule: LocalAuthentication, platformOs: Platform.OS });
    if (!auth.success) {
      setNotice(`Could not enable biometrics: ${auth.error}.`);
      return;
    }
    // Re-derive the raw vault key via the wrapped copy: we need the KEK.
    // The KEK is only in memory while unlocked — re-derive it from the
    // master password is not possible here, so store the raw key from the
    // current session. The App keeps vaultKeyRaw after unlock.
    if (!vaultKeyRawRef.current) {
      setNotice('Biometric unlock needs a fresh master-password unlock first. Lock and unlock with your master password, then enable it.');
      return;
    }
    await enableBiometrics(adapter, keyStore, vaultKeyRawRef.current);
    setBiometricEnabled(true);
    setNotice('Biometric unlock enabled.');
  }, [adapter, store, isDemo, biometricEnabled]);

  const handleSaveEntry = useCallback(async (data) => {
    if (!store) return;
    if (selectedEntry && selectedEntry !== 'new') {
      await store.updateEntry(selectedEntry.id, data);
    } else {
      await store.addEntry(data);
    }
    setSelectedEntry(null);
    setPrefillPassword('');
    await refreshEntries(store);
  }, [store, selectedEntry, refreshEntries]);

  const handleDeleteEntry = useCallback(async () => {
    if (!store || !selectedEntry || selectedEntry === 'new') return;
    await store.deleteEntry(selectedEntry.id);
    setSelectedEntry(null);
    await refreshEntries(store);
  }, [store, selectedEntry, refreshEntries]);

  const handleChangeMasterPassword = useCallback(async (oldPassword, newPassword) => {
    if (!adapter) throw new Error('Vault is not ready');
    await changeMasterPassword(adapter, keyStore, oldPassword, newPassword);
  }, [adapter]);

  const handleExportBackup = useCallback(async () => {
    if (!store || !kek) return;
    try {
      const blob = await encryptBackup(entries, kek);
      const json = JSON.stringify(blob, null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `biovault-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setNotice('Backup downloaded (encrypted — it needs your master password to restore).');
      } else {
        const path = `${FileSystem.cacheDirectory}biovault-backup.json`;
        await FileSystem.writeAsStringAsync(path, json);
        await Sharing.shareAsync(path, { mimeType: 'application/json' });
        setNotice('Backup shared (encrypted — it needs your master password to restore).');
      }
    } catch (e) {
      setNotice(`Backup export failed: ${e.message}`);
    }
  }, [store, kek, entries]);

  const handleImportBackup = useCallback(async () => {
    if (!store || !kek) return;
    try {
      let text = '';
      if (Platform.OS === 'web') {
        text = await new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json,.json';
          input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return reject(new Error('No file selected'));
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Could not read the file'));
            reader.readAsText(file);
          };
          input.click();
        });
      } else {
        const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
        if (picked.canceled) return;
        text = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      }
      const imported = await decryptBackup(JSON.parse(text), kek);
      await store.replaceAll(imported);
      await refreshEntries(store);
      setNotice(`Backup imported: ${imported.length} entries restored.`);
    } catch (e) {
      setNotice(`Backup import failed: ${e.message}`);
    }
  }, [store, kek, refreshEntries]);

  const handleEraseVault = useCallback(() => {
    Alert.alert(
      'Erase vault?',
      'This deletes every entry, the salt and the wrapped key. There is no recovery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            if (!adapter) return;
            await adapter.clearAll();
            await keyStore.delete('biovault-wrapped-key');
            await keyStore.delete('biovault-wrapped-key-iv');
            await keyStore.deleteAuth('biovault-raw-key');
            lockVault();
            setPhase('setup');
          },
        },
      ],
    );
  }, [adapter, lockVault]);

  const handleUseGeneratedPassword = useCallback((password) => {
    setPrefillPassword(password);
    setSelectedEntry('new');
    setTab('vault');
  }, []);

  const header = useMemo(() => (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>🔒 BioVault</Text>
        <Text style={styles.headerSub}>Biometric Password Vault</Text>
      </View>
      <View style={styles.headerRight}>
        {isDemo ? <Pill text="DEMO MODE" tone="warning" testID="demo-pill" /> : null}
        {phase === 'unlocked' ? (
          <TouchableOpacity onPress={lockVault} testID="header-lock" style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  ), [isDemo, phase, lockVault]);

  const tabs = useMemo(() => (
    <View style={styles.tabBar}>
      {TABS.map((t) => (
        <TouchableOpacity
          key={t.id}
          testID={t.testID}
          onPress={() => { setSelectedEntry(null); setTab(t.id); }}
          style={[styles.tab, tab === t.id && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [tab]);

  if (phase === 'loading' || !adapter) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <Loading label="Opening your vault…" />
      </View>
    );
  }

  if (phase === 'setup') {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        {header}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {storageNote ? <Text style={styles.storageNote}>{storageNote}</Text> : null}
          <SetupScreen onSetup={handleSetup} busy={busy} />
        </ScrollView>
      </View>
    );
  }

  if (phase === 'locked') {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        {header}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <LockScreen
            biometricLabel={biometricStatus.label || 'Fingerprint / Face'}
            biometricAvailable={biometricStatus.available && biometricEnabled}
            onUnlockPassword={handleUnlockPassword}
            onUnlockBiometric={handleUnlockBiometric}
            onDemo={() => enterDemo('vault')}
            onSimulateBiometric={handleSimulateBiometric}
            busy={busy}
            demoMode
          />
        </ScrollView>
      </View>
    );
  }

  // unlocked
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {header}
      {tabs}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onTouchStart={() => dispatchLock({ type: 'activity' })}
      >
        {tab === 'vault' && !selectedEntry ? (
          <VaultScreen
            entries={entries}
            health={health}
            onOpenEntry={setSelectedEntry}
            onAddEntry={() => { setPrefillPassword(''); setSelectedEntry('new'); }}
          />
        ) : null}
        {tab === 'vault' && selectedEntry ? (
          <EntryScreen
            entry={selectedEntry === 'new' ? null : selectedEntry}
            prefillPassword={prefillPassword}
            isNew={selectedEntry === 'new'}
            onSave={handleSaveEntry}
            onDelete={handleDeleteEntry}
            onBack={() => { setSelectedEntry(null); setPrefillPassword(''); }}
          />
        ) : null}
        {tab === 'generator' ? (
          <GeneratorScreen onUsePassword={handleUseGeneratedPassword} />
        ) : null}
        {tab === 'health' ? (
          <HealthScreen entries={entries} health={health} onOpenEntry={(e) => { setSelectedEntry(e); setTab('vault'); }} />
        ) : null}
        {tab === 'settings' ? (
          <SettingsScreen
            biometricStatus={biometricStatus}
            biometricEnabled={biometricEnabled}
            onToggleBiometric={handleToggleBiometric}
            onChangeMasterPassword={handleChangeMasterPassword}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onLockNow={lockVault}
            onEraseVault={handleEraseVault}
            isDemo={isDemo}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.surface },
  lockBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.primary },
  notice: { margin: 16, marginBottom: 0, backgroundColor: colors.infoBg, color: colors.infoText, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19 },
  storageNote: { margin: 16, marginBottom: 0, backgroundColor: colors.warningBg, color: colors.warningText, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19 },
});
