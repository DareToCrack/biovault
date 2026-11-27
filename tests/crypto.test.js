import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PBKDF2_ITERATIONS,
  deriveKek,
  kekVerificationHash,
  generateVaultKey,
  importVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptEntry,
  decryptEntry,
  encryptBackup,
  decryptBackup,
  sha256Hex,
  bytesToBase64url,
  base64urlToBytes,
  randomBytes,
} from '../app/src/crypto/core.js';

const entry = {
  id: 'e1',
  name: 'Gmail',
  username: 'a@b.com',
  password: 'S3cret!Pass',
  url: 'https://mail.google.com',
  category: 'Login',
  notes: '',
  favourite: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  passwordChangedAt: 1700000000000,
};

test('PBKDF2 iterations match the documented 600,000', () => {
  assert.equal(PBKDF2_ITERATIONS, 600000);
});

test('deriveKek is deterministic for the same password + salt', async () => {
  const salt = randomBytes(16);
  const a = await deriveKek('correct horse battery staple', salt);
  const b = await deriveKek('correct horse battery staple', salt);
  assert.equal(await kekVerificationHash(a), await kekVerificationHash(b));
});

test('deriveKek differs for a different salt or password', async () => {
  const salt = randomBytes(16);
  const a = await deriveKek('password-one', salt);
  const b = await deriveKek('password-one', randomBytes(16));
  const c = await deriveKek('password-two', salt);
  assert.notEqual(await kekVerificationHash(a), await kekVerificationHash(b));
  assert.notEqual(await kekVerificationHash(a), await kekVerificationHash(c));
});

test('deriveKek rejects an empty master password', async () => {
  await assert.rejects(() => deriveKek('', randomBytes(16)), /must not be empty/);
});

test('wrap/unwrap round-trip returns the same vault key', async () => {
  const kek = await deriveKek('master-password', randomBytes(16));
  const { raw } = await generateVaultKey();
  const { wrappedB64url, ivB64url } = await wrapVaultKey(raw, kek);
  const unwrapped = await unwrapVaultKey(wrappedB64url, ivB64url, kek);
  assert.deepEqual([...unwrapped], [...raw]);
});

test('unwrap with the wrong KEK fails', async () => {
  const kek = await deriveKek('master-password', randomBytes(16));
  const wrongKek = await deriveKek('wrong-password', randomBytes(16));
  const { raw } = await generateVaultKey();
  const { wrappedB64url, ivB64url } = await wrapVaultKey(raw, kek);
  await assert.rejects(() => unwrapVaultKey(wrappedB64url, ivB64url, wrongKek));
});

test('entry encrypt/decrypt round-trip preserves the entry', async () => {
  const { key } = await generateVaultKey();
  const row = await encryptEntry(entry, key);
  assert.equal(typeof row.ciphertextB64url, 'string');
  assert.equal(typeof row.ivB64url, 'string');
  assert.match(row.sha256, /^[0-9a-f]{64}$/);
  const back = await decryptEntry(row, key);
  assert.deepEqual(back, entry);
});

test('entry decryption fails when the ciphertext is tampered with', async () => {
  const { key } = await generateVaultKey();
  const row = await encryptEntry(entry, key);
  const bytes = base64urlToBytes(row.ciphertextB64url);
  bytes[0] ^= 0xff; // flip a byte
  const tampered = { ...row, ciphertextB64url: bytesToBase64url(bytes) };
  await assert.rejects(() => decryptEntry(tampered, key), /Integrity check failed/);
});

test('entry decryption fails with the wrong vault key', async () => {
  const { key } = await generateVaultKey();
  const { key: otherKey } = await generateVaultKey();
  const row = await encryptEntry(entry, key);
  await assert.rejects(() => decryptEntry(row, otherKey), /Integrity check failed|Decryption failed/);
});

test('entry decryption fails when the stored hash is wrong', async () => {
  const { key } = await generateVaultKey();
  const row = await encryptEntry(entry, key);
  await assert.rejects(
    () => decryptEntry({ ...row, sha256: '00'.repeat(32) }, key),
    /Integrity check failed/,
  );
});

test('two encryptions of the same entry differ (fresh IV each time)', async () => {
  const { key } = await generateVaultKey();
  const a = await encryptEntry(entry, key);
  const b = await encryptEntry(entry, key);
  assert.notEqual(a.ciphertextB64url, b.ciphertextB64url);
  assert.notEqual(a.ivB64url, b.ivB64url);
});

test('importVaultKey rejects a short key', async () => {
  await assert.rejects(() => importVaultKey(new Uint8Array(16)), /32 bytes/);
});

test('backup encrypt/decrypt round-trip', async () => {
  const kek = await deriveKek('master-password', randomBytes(16));
  const blob = await encryptBackup([entry], kek);
  assert.equal(blob.version, 1);
  const back = await decryptBackup(blob, kek);
  assert.deepEqual(back, [entry]);
});

test('backup decryption fails with the wrong master password', async () => {
  const kek = await deriveKek('master-password', randomBytes(16));
  const wrongKek = await deriveKek('wrong-password', randomBytes(16));
  const blob = await encryptBackup([entry], kek);
  await assert.rejects(() => decryptBackup(blob, wrongKek), /Decryption failed/);
});

test('backup decryption rejects a bad version or tampered blob', async () => {
  const kek = await deriveKek('master-password', randomBytes(16));
  const blob = await encryptBackup([entry], kek);
  await assert.rejects(() => decryptBackup({ ...blob, version: 99 }, kek), /Not a BioVault backup/);
  const bytes = base64urlToBytes(blob.ciphertextB64url);
  bytes[5] ^= 0x01;
  await assert.rejects(
    () => decryptBackup({ ...blob, ciphertextB64url: bytesToBase64url(bytes) }, kek),
    /Integrity check failed/,
  );
});

test('sha256Hex is stable and correct for a known input', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
