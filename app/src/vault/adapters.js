/**
 * Storage adapters — one interface, two backends.
 *
 * Every adapter implements the same async interface:
 *   init(), getMeta(key), setMeta(key, value), deleteMeta(key),
 *   listEntries(), putEntry(row), deleteEntry(id), clearAll()
 *
 * Rows stored: { id, ciphertextB64url, ivB64url, sha256, createdAt, updatedAt }
 * Only ciphertext ever reaches storage — no plaintext, ever.
 *
 * This file holds the in-memory adapter (tests + demo mode). The SQLite
 * adapter lives in sqliteAdapter.js because it imports expo-sqlite,
 * which cannot load in Node.
 */

export class MemoryAdapter {
  constructor() {
    this.meta = new Map();
    this.entries = new Map();
    this.initialised = false;
  }

  async init() {
    this.initialised = true;
  }

  async getMeta(key) {
    return this.meta.has(key) ? this.meta.get(key) : null;
  }

  async setMeta(key, value) {
    this.meta.set(key, value);
  }

  async deleteMeta(key) {
    this.meta.delete(key);
  }

  async listEntries() {
    return [...this.entries.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async putEntry(row) {
    this.entries.set(row.id, { ...row });
  }

  async deleteEntry(id) {
    this.entries.delete(id);
  }

  async clearAll() {
    this.meta.clear();
    this.entries.clear();
  }
}
