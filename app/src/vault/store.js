/**
 * VaultStore — entry CRUD over a storage adapter, with per-entry
 * AES-256-GCM encryption (see src/crypto/core.js).
 *
 * The store never sees a plaintext password outside memory: entries are
 * decrypted on load into memory and re-encrypted on every write, each
 * time with a fresh random IV.
 */
import { encryptEntry, decryptEntry, randomBytes, bytesToHex } from '../crypto/core.js';

export const CATEGORIES = ['Login', 'Finance', 'Social', 'Work', 'Wi-Fi', 'Other'];

function newId() {
  return `e_${bytesToHex(randomBytes(8))}`;
}

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Entry must be an object');
  if (!String(entry.name || '').trim()) throw new Error('Site / app name is required');
  if (!String(entry.password || '')) throw new Error('Password is required');
  if (entry.url && !/^https?:\/\//i.test(String(entry.url))) {
    throw new Error('URL must start with http:// or https://');
  }
  if (entry.category && !CATEGORIES.includes(entry.category)) {
    throw new Error(`Unknown category: ${entry.category}`);
  }
}

export class VaultStore {
  /**
   * @param {object} adapter - a storage adapter (see adapters.js)
   * @param {CryptoKey} vaultKey - the unlocked vault key (in memory only)
   */
  constructor(adapter, vaultKey) {
    this.adapter = adapter;
    this.vaultKey = vaultKey;
  }

  async addEntry(entry) {
    validateEntry(entry);
    const now = Date.now();
    const full = {
      id: newId(),
      name: String(entry.name).trim(),
      username: String(entry.username || ''),
      password: String(entry.password),
      url: String(entry.url || ''),
      category: entry.category || 'Other',
      notes: String(entry.notes || ''),
      favourite: Boolean(entry.favourite),
      createdAt: now,
      updatedAt: now,
      passwordChangedAt: now,
    };
    const enc = await encryptEntry(full, this.vaultKey);
    await this.adapter.putEntry({
      id: full.id,
      ...enc,
      createdAt: now,
      updatedAt: now,
    });
    return full;
  }

  async updateEntry(id, patch) {
    const existing = await this.getEntry(id);
    if (!existing) throw new Error('Entry not found');
    const passwordChanged = patch.password !== undefined && patch.password !== existing.password;
    const merged = {
      ...existing,
      ...patch,
      id: existing.id,
      name: patch.name !== undefined ? String(patch.name).trim() : existing.name,
      updatedAt: Date.now(),
      passwordChangedAt: passwordChanged ? Date.now() : existing.passwordChangedAt,
    };
    validateEntry(merged);
    const enc = await encryptEntry(merged, this.vaultKey);
    await this.adapter.putEntry({
      id: merged.id,
      ...enc,
      createdAt: merged.createdAt,
      updatedAt: merged.updatedAt,
    });
    return merged;
  }

  async deleteEntry(id) {
    await this.adapter.deleteEntry(id);
  }

  async getEntry(id) {
    const rows = await this.adapter.listEntries();
    const row = rows.find((r) => r.id === id);
    if (!row) return null;
    return decryptEntry(row, this.vaultKey);
  }

  /** Decrypt and return all entries, favourites first, then by name. */
  async listEntries() {
    const rows = await this.adapter.listEntries();
    const entries = [];
    for (const row of rows) {
      entries.push(await decryptEntry(row, this.vaultKey));
    }
    entries.sort((a, b) => {
      if (a.favourite !== b.favourite) return a.favourite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return entries;
  }

  /** Replace the whole vault (used by backup import). */
  async replaceAll(entries) {
    const rows = await this.adapter.listEntries();
    for (const row of rows) await this.adapter.deleteEntry(row.id);
    const now = Date.now();
    for (const entry of entries) {
      validateEntry(entry);
      const full = {
        ...entry,
        id: entry.id || newId(),
        createdAt: entry.createdAt || now,
        updatedAt: entry.updatedAt || now,
        passwordChangedAt: entry.passwordChangedAt || entry.updatedAt || now,
      };
      const enc = await encryptEntry(full, this.vaultKey);
      await this.adapter.putEntry({
        id: full.id,
        ...enc,
        createdAt: full.createdAt,
        updatedAt: full.updatedAt,
      });
    }
  }
}
