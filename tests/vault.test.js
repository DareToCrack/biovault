import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAdapter } from '../app/src/vault/adapters.js';
import { VaultStore } from '../app/src/vault/store.js';
import { deriveKek, generateVaultKey, randomBytes } from '../app/src/crypto/core.js';
import {
  setupVault,
  unlockWithPassword,
  unlockWithBiometrics,
  enableBiometrics,
  disableBiometrics,
  isVaultSetup,
  isBiometricEnabled,
  changeMasterPassword,
} from '../app/src/vault/keyring.js';

function entry(overrides = {}) {
  return {
    name: 'GitHub',
    username: 'dev@example.com',
    password: 'Gh!9dF2kL8@pQ4sT',
    url: 'https://github.com',
    category: 'Work',
    notes: '',
    favourite: false,
    ...overrides,
  };
}

/** Minimal fake keyStore (plain object, in-memory) for keyring tests. */
function fakeKeyStore() {
  const map = new Map();
  const auth = new Map();
  return {
    async set(k, v) { map.set(k, v); },
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async delete(k) { map.delete(k); },
    async setAuth(k, v) { auth.set(k, v); },
    async getAuth(k) { return auth.has(k) ? auth.get(k) : null; },
    async deleteAuth(k) { auth.delete(k); },
    _map: map,
    _auth: auth,
  };
}

async function seededStore() {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const { key } = await generateVaultKey();
  return { adapter, store: new VaultStore(adapter, key) };
}

test('VaultStore add/list returns decrypted entries', async () => {
  const { store } = await seededStore();
  const created = await store.addEntry(entry());
  const list = await store.listEntries();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);
  assert.equal(list[0].password, 'Gh!9dF2kL8@pQ4sT');
  assert.equal(list[0].name, 'GitHub');
});

test('entries are stored encrypted — the adapter never sees plaintext', async () => {
  const { adapter, store } = await seededStore();
  await store.addEntry(entry({ password: 'SuperSecret!99' }));
  const rows = await adapter.listEntries();
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0].ciphertextB64url, 'string');
  assert.ok(!JSON.stringify(rows[0]).includes('SuperSecret!99'));
  assert.ok(!JSON.stringify(rows[0]).includes('GitHub'));
});

test('VaultStore update changes only the edited fields and bumps updatedAt', async () => {
  const { store } = await seededStore();
  const { id } = await store.addEntry(entry());
  const before = await store.getEntry(id);
  await new Promise((r) => setTimeout(r, 2));
  await store.updateEntry(id, { name: 'GitHub (work)', password: 'New!Pass1234' });
  const after = await store.getEntry(id);
  assert.equal(after.name, 'GitHub (work)');
  assert.equal(after.password, 'New!Pass1234');
  assert.equal(after.username, 'dev@example.com');
  assert.ok(after.updatedAt >= before.updatedAt);
  assert.ok(after.passwordChangedAt >= before.passwordChangedAt);
});

test('VaultStore delete removes the entry; getEntry then returns null', async () => {
  const { store } = await seededStore();
  const { id } = await store.addEntry(entry());
  await store.deleteEntry(id);
  assert.equal(await store.getEntry(id), null);
  assert.deepEqual(await store.listEntries(), []);
});

test('favourites sort first, then by name', async () => {
  const { store } = await seededStore();
  await store.addEntry(entry({ name: 'Mango', favourite: false }));
  await store.addEntry(entry({ name: 'Zebra', favourite: true }));
  await store.addEntry(entry({ name: 'Alpha', favourite: false }));
  const names = (await store.listEntries()).map((e) => e.name);
  assert.deepEqual(names, ['Zebra', 'Alpha', 'Mango']);
});

test('validation rejects a missing name, a missing password, or a bad category', async () => {
  const { store } = await seededStore();
  await assert.rejects(() => store.addEntry(entry({ name: '' })), /name is required/);
  await assert.rejects(() => store.addEntry(entry({ password: '' })), /Password is required/);
  await assert.rejects(() => store.addEntry(entry({ category: 'Nope' })), /Unknown category/);
  await assert.rejects(() => store.addEntry(entry({ url: 'not a url' })), /URL must start with http/);
});

test('replaceAll swaps the whole vault (used by demo + backup import)', async () => {
  const { store } = await seededStore();
  await store.addEntry(entry({ name: 'Old' }));
  await store.replaceAll([entry({ name: 'New 1' }), entry({ name: 'New 2' })]);
  const names = (await store.listEntries()).map((e) => e.name).sort();
  assert.deepEqual(names, ['New 1', 'New 2']);
});

test('keyring: setup then unlock with the same master password', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const ks = fakeKeyStore();
  await setupVault(adapter, ks, 'correct-horse-battery');
  assert.equal(await isVaultSetup(adapter), true);
  const { vaultKey } = await unlockWithPassword(adapter, ks, 'correct-horse-battery');
  assert.ok(vaultKey);
  const store = new VaultStore(adapter, vaultKey);
  await store.addEntry(entry());
  assert.equal((await store.listEntries()).length, 1);
});

test('keyring: unlock fails with the wrong master password', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const ks = fakeKeyStore();
  await setupVault(adapter, ks, 'correct-horse-battery');
  await assert.rejects(
    () => unlockWithPassword(adapter, ks, 'wrong-password'),
    /Wrong master password/,
  );
});

test('keyring: changeMasterPassword re-wraps the key — old password fails, new works, entries survive', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const ks = fakeKeyStore();
  const { vaultKey } = await setupVault(adapter, ks, 'old-password');
  const store = new VaultStore(adapter, vaultKey);
  await store.addEntry(entry());
  await changeMasterPassword(adapter, ks, 'old-password', 'new-password');
  await assert.rejects(() => unlockWithPassword(adapter, ks, 'old-password'), /Wrong master password/);
  const unlocked = await unlockWithPassword(adapter, ks, 'new-password');
  const store2 = new VaultStore(adapter, unlocked.vaultKey);
  assert.equal((await store2.listEntries()).length, 1);
  assert.equal((await store2.listEntries())[0].name, 'GitHub');
});

test('keyring: changeMasterPassword rejects a wrong old password', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const ks = fakeKeyStore();
  await setupVault(adapter, ks, 'old-password');
  await assert.rejects(
    () => changeMasterPassword(adapter, ks, 'not-the-old-one', 'new-password'),
    /Wrong master password/,
  );
});

test('keyring: setup rejects a short master password', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  await assert.rejects(() => setupVault(adapter, fakeKeyStore(), 'short'), /at least 8 characters/);
});

test('keyring: biometric enable → unlock via the OS-gated copy, disable removes it', async () => {
  const adapter = new MemoryAdapter();
  await adapter.init();
  const ks = fakeKeyStore();
  const { vaultKeyRaw } = await setupVault(adapter, ks, 'master-password');
  await assert.rejects(() => unlockWithBiometrics(ks), /Biometric unlock is not set up/);
  await enableBiometrics(adapter, ks, vaultKeyRaw);
  assert.equal(await isBiometricEnabled(adapter), true);
  const { vaultKey } = await unlockWithBiometrics(ks);
  const store = new VaultStore(adapter, vaultKey);
  await store.addEntry(entry());
  assert.equal((await store.listEntries()).length, 1);
  await disableBiometrics(adapter, ks);
  assert.equal(await isBiometricEnabled(adapter), false);
  await assert.rejects(() => unlockWithBiometrics(ks), /Biometric unlock is not set up/);
});

test('deriveKek output is a usable AES-GCM key (derived via PBKDF2, imported for wrapping)', async () => {
  const kek = await deriveKek('master', randomBytes(16));
  // The derived bits are imported as an AES-GCM key for wrap/unwrap.
  assert.equal(kek.algorithm.name, 'AES-GCM');
  assert.equal(kek.algorithm.length, 256);
  assert.ok(kek.usages.includes('encrypt'));
  assert.ok(kek.usages.includes('decrypt'));
});
