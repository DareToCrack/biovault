/**
 * BioVault crypto core — WebCrypto only, dependency-free.
 *
 * This module uses ONLY `globalThis.crypto` (WebCrypto) and standard
 * built-ins, so it runs unchanged in browsers (Expo web), in Node 19+
 * (tests / tooling), and anywhere else WebCrypto exists. It imports
 * nothing from React Native — see polyfill-note.js for the native story.
 *
 * Design (one random vault key, wrapped by a key derived from the master
 * password):
 *  - Master password -> KEK (key-encryption key) via PBKDF2-SHA-256,
 *    600,000 iterations, random 16-byte salt. The master password is
 *    NEVER stored; only a verification hash of the derived KEK is kept.
 *  - Vault key: fresh random 256-bit AES-GCM key per vault. It is stored
 *    WRAPPED (AES-GCM-encrypted with the KEK, its own random 12-byte IV)
 *    in the secure key store — never in plaintext, never in SQLite.
 *  - Each entry: the whole entry JSON is encrypted with the vault key
 *    (AES-256-GCM, fresh random 12-byte IV per entry). SQLite stores
 *    ciphertext + IV + SHA-256 of the ciphertext only — no plaintext.
 *  - SHA-256 of the ciphertext is verified before decrypting; GCM's auth
 *    tag also fails decryption on any tampering.
 *  - Keys are NEVER logged and NEVER persisted by this module.
 */

export const PBKDF2_ITERATIONS = 600000;
export const KEY_LENGTH_BITS = 256;
export const IV_LENGTH_BYTES = 12;
export const SALT_LENGTH_BYTES = 16;
export const GCM_TAG_LENGTH_BITS = 128;

function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'WebCrypto is not available in this environment. On the web, serve the app over HTTPS or localhost. On React Native, see polyfill-note.js.',
    );
  }
  return subtle;
}

function getRandomValues() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random numbers are not available in this environment.');
  }
  return globalThis.crypto.getRandomValues.bind(globalThis.crypto);
}

/** Cryptographically random bytes. */
export function randomBytes(length) {
  return getRandomValues()(new Uint8Array(length));
}

/** URL-safe base64 (RFC 4648 §5) without padding. Browser- and Node-safe. */
export function bytesToBase64url(bytes) {
  const bin = [];
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str)) {
    throw new Error('Invalid base64url string');
  }
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 digest as a lowercase hex string. Accepts a string or bytes. */
export async function sha256Hex(data) {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await getSubtle().digest('SHA-256', input);
  return bytesToHex(new Uint8Array(digest));
}

/** Derive the KEK (AES-256-GCM key) from a master password + salt. */
export async function deriveKek(masterPassword, salt) {
  if (!masterPassword) throw new Error('Master password must not be empty');
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true, // extractable so we can hash it for verification; the app never exports it elsewhere
    ['encrypt', 'decrypt'],
  );
}

/** Verification hash of a derived KEK (raw key bytes -> SHA-256 hex). */
export async function kekVerificationHash(kek) {
  const raw = new Uint8Array(await getSubtle().exportKey('raw', kek));
  return sha256Hex(raw);
}

/** Generate a fresh random 256-bit AES-GCM vault key. Returns { key, raw }. */
export async function generateVaultKey() {
  const key = await getSubtle().generateKey(
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true, // extractable: the raw key is wrapped (encrypted) for storage
    ['encrypt', 'decrypt'],
  );
  const raw = new Uint8Array(await getSubtle().exportKey('raw', key));
  return { key, raw };
}

/** Import a raw 32-byte vault key. */
export async function importVaultKey(rawBytes) {
  if (rawBytes.length !== 32) throw new Error('Vault key must be 32 bytes (AES-256)');
  return getSubtle().importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** AES-256-GCM encrypt. Returns ciphertext WITH the auth tag appended. */
export async function encryptBytes(plaintext, key, iv) {
  if (iv.length !== IV_LENGTH_BYTES) throw new Error('IV must be 12 bytes');
  const out = await getSubtle().encrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH_BITS },
    key,
    plaintext,
  );
  return new Uint8Array(out);
}

/**
 * AES-256-GCM decrypt. Throws (OperationError) if the ciphertext was
 * tampered with or the key/IV is wrong — GCM authentication failure.
 */
export async function decryptBytes(ciphertext, key, iv) {
  if (iv.length !== IV_LENGTH_BYTES) throw new Error('IV must be 12 bytes');
  const out = await getSubtle().decrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH_BITS },
    key,
    ciphertext,
  );
  return new Uint8Array(out);
}

/**
 * Wrap (encrypt) a raw vault key with the KEK for storage.
 * Returns { wrappedB64url, ivB64url }.
 */
export async function wrapVaultKey(vaultKeyRaw, kek) {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const wrapped = await encryptBytes(vaultKeyRaw, kek, iv);
  return { wrappedB64url: bytesToBase64url(wrapped), ivB64url: bytesToBase64url(iv) };
}

/** Unwrap a wrapped vault key with the KEK. Returns the raw 32-byte key. */
export async function unwrapVaultKey(wrappedB64url, ivB64url, kek) {
  const wrapped = base64urlToBytes(wrappedB64url);
  const iv = base64urlToBytes(ivB64url);
  return decryptBytes(wrapped, kek, iv);
}

/**
 * Encrypt one vault entry (a plain object) with the vault key.
 * Returns { ciphertextB64url, ivB64url, sha256 } — everything SQLite stores.
 */
export async function encryptEntry(entry, vaultKey) {
  const plain = new TextEncoder().encode(JSON.stringify(entry));
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ciphertext = await encryptBytes(plain, vaultKey, iv);
  return {
    ciphertextB64url: bytesToBase64url(ciphertext),
    ivB64url: bytesToBase64url(iv),
    sha256: await sha256Hex(ciphertext),
  };
}

/**
 * Decrypt one vault entry. Verifies the SHA-256 integrity hash BEFORE
 * decrypting, then relies on the GCM auth tag as a second check.
 */
export async function decryptEntry(row, vaultKey) {
  const ciphertext = base64urlToBytes(row.ciphertextB64url);
  const actualHash = await sha256Hex(ciphertext);
  if (actualHash !== String(row.sha256).toLowerCase()) {
    throw new Error('Integrity check failed: stored data does not match its SHA-256 hash (corrupted or tampered).');
  }
  const iv = base64urlToBytes(row.ivB64url);
  let plain;
  try {
    plain = await decryptBytes(ciphertext, vaultKey, iv);
  } catch {
    throw new Error('Decryption failed: wrong vault key, or the entry was tampered with.');
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

/**
 * Encrypt a whole-vault backup (array of decrypted entries) with the KEK.
 * Returns { version, ivB64url, ciphertextB64url, sha256 }.
 */
export async function encryptBackup(entries, kek) {
  const plain = new TextEncoder().encode(JSON.stringify({ version: 1, entries }));
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ciphertext = await encryptBytes(plain, kek, iv);
  return {
    version: 1,
    ivB64url: bytesToBase64url(iv),
    ciphertextB64url: bytesToBase64url(ciphertext),
    sha256: await sha256Hex(ciphertext),
  };
}

/** Decrypt a backup blob produced by encryptBackup. Returns the entry array. */
export async function decryptBackup(blob, kek) {
  if (!blob || blob.version !== 1 || !blob.ciphertextB64url || !blob.ivB64url) {
    throw new Error('Not a BioVault backup file (bad version or missing fields).');
  }
  const ciphertext = base64urlToBytes(blob.ciphertextB64url);
  const actualHash = await sha256Hex(ciphertext);
  if (blob.sha256 && actualHash !== String(blob.sha256).toLowerCase()) {
    throw new Error('Integrity check failed: backup does not match its SHA-256 hash (corrupted or tampered).');
  }
  const iv = base64urlToBytes(blob.ivB64url);
  let plain;
  try {
    plain = await decryptBytes(ciphertext, kek, iv);
  } catch {
    throw new Error('Decryption failed: wrong master password, or the backup was tampered with.');
  }
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error('Not a BioVault backup file (bad contents).');
  }
  return parsed.entries;
}
