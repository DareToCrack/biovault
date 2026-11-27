/**
 * Keyring — master-password setup, unlock, biometric unlock, and
 * master-password change.
 *
 * Key hierarchy:
 *   master password --PBKDF2-SHA-256, 600k, salt--> KEK
 *   KEK --AES-GCM wrap--> vault key (random 256-bit, per vault)
 *   vault key --AES-GCM per entry--> entry ciphertexts (SQLite)
 *
 * Stored (meta table): salt, KEK verification hash, biometric flag.
 * Stored (secure key store):
 *   - the WRAPPED vault key + its IV (master-password path; the KEK is
 *     needed to unwrap it, so the master password is always required
 *     for this path).
 *   - the RAW vault key, only when biometrics are enabled, stored with
 *     the OS's biometric gate (`requireAuthentication` on native) — the
 *     biometric path. The OS releases it only after a fingerprint/face
 *     match; the master password is not needed for this path.
 * Never stored anywhere: the master password, the KEK, or the vault key
 * in plaintext outside the OS-gated store.
 *
 * The keyStore is injected (platform-specific): expo-secure-store on
 * native (keyStore.native.js), in-memory only on web (keyStore.web.js).
 * Tests pass a fake in-memory key store.
 */
import {
  deriveKek,
  kekVerificationHash,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  importVaultKey,
  randomBytes,
  bytesToBase64url,
  base64urlToBytes,
  SALT_LENGTH_BYTES,
} from '../crypto/core.js';

export const META_SALT = 'salt';
export const META_VERIFY_HASH = 'verifyHash';
export const META_BIOMETRIC_ENABLED = 'biometricEnabled';
export const WRAPPED_KEY_STORE_KEY = 'biovault-wrapped-key';
export const WRAPPED_KEY_IV_STORE_KEY = 'biovault-wrapped-key-iv';
export const RAW_KEY_STORE_KEY = 'biovault-raw-key';

export async function isVaultSetup(adapter) {
  const salt = await adapter.getMeta(META_SALT);
  return Boolean(salt);
}

export async function isBiometricEnabled(adapter) {
  return (await adapter.getMeta(META_BIOMETRIC_ENABLED)) === '1';
}

export async function setBiometricEnabled(adapter, enabled) {
  await adapter.setMeta(META_BIOMETRIC_ENABLED, enabled ? '1' : '0');
}

/**
 * First-time setup. Creates the salt, KEK, vault key, wrapped key and
 * verification hash. Returns { kek, vaultKey, vaultKeyRaw } (in memory
 * only — the caller keeps vaultKeyRaw only as long as setup needs it).
 */
export async function setupVault(adapter, keyStore, masterPassword) {
  if (!masterPassword || masterPassword.length < 8) {
    throw new Error('Master password must be at least 8 characters');
  }
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const kek = await deriveKek(masterPassword, salt);
  const { key: vaultKey, raw: vaultKeyRaw } = await generateVaultKey();
  const { wrappedB64url, ivB64url } = await wrapVaultKey(vaultKeyRaw, kek);
  const verifyHash = await kekVerificationHash(kek);
  await adapter.setMeta(META_SALT, bytesToBase64url(salt));
  await adapter.setMeta(META_VERIFY_HASH, verifyHash);
  await adapter.setMeta(META_BIOMETRIC_ENABLED, '0');
  await keyStore.set(WRAPPED_KEY_STORE_KEY, wrappedB64url);
  await keyStore.set(WRAPPED_KEY_IV_STORE_KEY, ivB64url);
  return { kek, vaultKey, vaultKeyRaw };
}

/**
 * Unlock with the master password. Verifies the KEK hash first, so a
 * wrong password fails before any unwrapping is attempted.
 * Returns { kek, vaultKey, vaultKeyRaw }.
 */
export async function unlockWithPassword(adapter, keyStore, masterPassword) {
  const saltB64 = await adapter.getMeta(META_SALT);
  const expectedHash = await adapter.getMeta(META_VERIFY_HASH);
  if (!saltB64 || !expectedHash) throw new Error('Vault is not set up yet');
  const kek = await deriveKek(masterPassword, base64urlToBytes(saltB64));
  const actualHash = await kekVerificationHash(kek);
  if (actualHash !== expectedHash.toLowerCase()) {
    throw new Error('Wrong master password');
  }
  const vaultKey = await loadVaultKey(keyStore, kek);
  const vaultKeyRaw = await unwrapVaultKey(
    await keyStore.get(WRAPPED_KEY_STORE_KEY),
    await keyStore.get(WRAPPED_KEY_IV_STORE_KEY),
    kek,
  );
  return { kek, vaultKey, vaultKeyRaw };
}

/** Load + unwrap the vault key from the secure key store. */
export async function loadVaultKey(keyStore, kek) {
  const wrappedB64url = await keyStore.get(WRAPPED_KEY_STORE_KEY);
  const ivB64url = await keyStore.get(WRAPPED_KEY_IV_STORE_KEY);
  if (!wrappedB64url || !ivB64url) {
    throw new Error('Wrapped vault key not found — the vault may need to be set up again');
  }
  const raw = await unwrapVaultKey(wrappedB64url, ivB64url, kek);
  return importVaultKey(raw);
}

/**
 * Enable biometric unlock: store the raw vault key in the OS-gated
 * store (the OS releases it only after a biometric match) and flip the
 * flag. The caller must have already authenticated biometrically.
 */
export async function enableBiometrics(adapter, keyStore, vaultKeyRaw) {
  await keyStore.setAuth(RAW_KEY_STORE_KEY, bytesToBase64url(vaultKeyRaw));
  await setBiometricEnabled(adapter, true);
}

/** Disable biometric unlock: delete the OS-gated raw key, clear the flag. */
export async function disableBiometrics(adapter, keyStore) {
  await keyStore.deleteAuth(RAW_KEY_STORE_KEY);
  await setBiometricEnabled(adapter, false);
}

/**
 * Biometric unlock path. The caller must have already passed the
 * biometric prompt (see auth/biometric.js) — on native, reading the
 * OS-gated store prompts again if needed. Returns { vaultKey }.
 * On web this always fails (no OS-gated store) — the caller must fall
 * back to the master password.
 */
export async function unlockWithBiometrics(keyStore) {
  const rawB64url = await keyStore.getAuth(RAW_KEY_STORE_KEY);
  if (!rawB64url) {
    throw new Error('Biometric unlock is not set up — use the master password');
  }
  const vaultKey = await importVaultKey(base64urlToBytes(rawB64url));
  return { vaultKey };
}

/**
 * Change the master password. Re-derives a new KEK, re-wraps the vault
 * key, and updates salt + verification hash. The vault key itself never
 * changes, so no entry needs re-encryption. If biometrics were enabled,
 * the OS-gated raw key stays valid (it is the same vault key).
 * Returns the new KEK.
 */
export async function changeMasterPassword(adapter, keyStore, oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New master password must be at least 8 characters');
  }
  // Verify the old password first (throws on a wrong password).
  const { kek: oldKek } = await unlockWithPassword(adapter, keyStore, oldPassword);
  const wrappedB64url = await keyStore.get(WRAPPED_KEY_STORE_KEY);
  const ivB64url = await keyStore.get(WRAPPED_KEY_IV_STORE_KEY);
  if (!wrappedB64url || !ivB64url) throw new Error('Wrapped vault key not found');
  const vaultKeyRaw = await unwrapVaultKey(wrappedB64url, ivB64url, oldKek);
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const newKek = await deriveKek(newPassword, salt);
  const wrapped = await wrapVaultKey(vaultKeyRaw, newKek);
  const verifyHash = await kekVerificationHash(newKek);
  await adapter.setMeta(META_SALT, bytesToBase64url(salt));
  await adapter.setMeta(META_VERIFY_HASH, verifyHash);
  await keyStore.set(WRAPPED_KEY_STORE_KEY, wrapped.wrappedB64url);
  await keyStore.set(WRAPPED_KEY_IV_STORE_KEY, wrapped.ivB64url);
  return { kek: newKek };
}
