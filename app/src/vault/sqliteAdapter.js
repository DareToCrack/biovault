/**
 * SQLite adapter (expo-sqlite, async API). Native + web.
 *
 * Tables:
 *   meta(key TEXT PRIMARY KEY, value TEXT)
 *   entries(id TEXT PRIMARY KEY, ciphertext TEXT, iv TEXT, sha256 TEXT,
 *           createdAt INTEGER, updatedAt INTEGER)
 *
 * On web, expo-sqlite runs wa-sqlite (WebAssembly) — see metro.config.js
 * for the wasm/COEP setup. All values are bound parameters (no string
 * interpolation) so user data can never break out of a query.
 */
import * as SQLite from 'expo-sqlite';

export class SQLiteAdapter {
  constructor(databaseName = 'biovault.db') {
    this.databaseName = databaseName;
    this.db = null;
  }

  async init() {
    this.db = await SQLite.openDatabaseAsync(this.databaseName);
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
  }

  async getMeta(key) {
    const row = await this.db.getFirstAsync('SELECT value FROM meta WHERE key = ?', key);
    return row ? row.value : null;
  }

  async setMeta(key, value) {
    await this.db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  async deleteMeta(key) {
    await this.db.runAsync('DELETE FROM meta WHERE key = ?', key);
  }

  async listEntries() {
    const rows = await this.db.getAllAsync(
      'SELECT id, ciphertext, iv, sha256, createdAt, updatedAt FROM entries ORDER BY createdAt ASC',
    );
    return rows.map((r) => ({
      id: r.id,
      ciphertextB64url: r.ciphertext,
      ivB64url: r.iv,
      sha256: r.sha256,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async putEntry(row) {
    await this.db.runAsync(
      `INSERT INTO entries (id, ciphertext, iv, sha256, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         ciphertext = excluded.ciphertext, iv = excluded.iv,
         sha256 = excluded.sha256, updatedAt = excluded.updatedAt`,
      row.id,
      row.ciphertextB64url,
      row.ivB64url,
      row.sha256,
      row.createdAt,
      row.updatedAt,
    );
  }

  async deleteEntry(id) {
    await this.db.runAsync('DELETE FROM entries WHERE id = ?', id);
  }

  async clearAll() {
    await this.db.execAsync('DELETE FROM entries; DELETE FROM meta;');
  }
}
