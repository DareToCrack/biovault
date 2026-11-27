/**
 * Secure key store — web implementation.
 *
 * expo-secure-store is not available on web, so the web build stores the
 * WRAPPED vault key in localStorage. That is acceptable because the value
 * is ciphertext: it can only be unwrapped with the KEK, which is derived
 * from the master password and is never stored. An attacker who reads
 * localStorage still needs the master password. The key is NOT protected
 * by the OS keychain on web — the README says so.
 *
 * Biometric-gated storage is not available on web at all — getAuth /
 * setAuth always fail, and the app falls back to the master password.
 */

const PREFIX = 'biovault:';

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

const memory = new Map();

export const keyStore = {
  async set(key, value) {
    if (storageAvailable()) {
      try {
        localStorage.setItem(PREFIX + key, value);
        return;
      } catch {
        // Quota or privacy mode — fall back to memory.
      }
    }
    memory.set(key, value);
  },
  async get(key) {
    if (storageAvailable()) {
      try {
        const v = localStorage.getItem(PREFIX + key);
        if (v !== null) return v;
      } catch {
        // Fall through to memory.
      }
    }
    return memory.has(key) ? memory.get(key) : null;
  },
  async delete(key) {
    if (storageAvailable()) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch {
        // Ignore.
      }
    }
    memory.delete(key);
  },
  async setAuth() {
    throw new Error('Biometric-gated storage is not available on web — use the master password');
  },
  async getAuth() {
    throw new Error('Biometric unlock is not available on web — use the master password');
  },
  async deleteAuth() {
    // Nothing to delete on web.
  },
};
