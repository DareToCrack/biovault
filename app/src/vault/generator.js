/**
 * Password generator — pure functions, no platform imports.
 * Randomness comes from WebCrypto (globalThis.crypto.getRandomValues),
 * which is real in browsers and Node 19+, and polyfilled on native
 * (see src/crypto/polyfill-note.js).
 */

export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';
export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';

/** Default generator options. */
export const DEFAULT_OPTIONS = {
  length: 16,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
};

function secureRandomInt(max) {
  // Rejection sampling — avoids modulo bias.
  if (max <= 0) throw new Error('max must be positive');
  const range = 0xffffffff;
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  let value;
  do {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}

/**
 * Generate a password. Guarantees at least one character from every
 * enabled set (when length allows), then shuffles with Fisher–Yates.
 */
export function generatePassword(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sets = [];
  if (opts.lowercase) sets.push(LOWERCASE);
  if (opts.uppercase) sets.push(UPPERCASE);
  if (opts.digits) sets.push(DIGITS);
  if (opts.symbols) sets.push(SYMBOLS);
  if (sets.length === 0) throw new Error('Enable at least one character set');
  const length = Math.max(1, Math.floor(opts.length));
  if (length < sets.length) {
    throw new Error(`Length ${length} is too short for ${sets.length} enabled character sets`);
  }
  const pool = sets.join('');
  const chars = sets.map((set) => set[secureRandomInt(set.length)]);
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pool[secureRandomInt(pool.length)]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Estimate password strength (0–100) from length and character variety.
 * Returns { score, label, entropyBits }.
 */
export function scorePassword(password) {
  const pw = String(password || '');
  let poolSize = 0;
  if (/[a-z]/.test(pw)) poolSize += 26;
  if (/[A-Z]/.test(pw)) poolSize += 26;
  if (/[0-9]/.test(pw)) poolSize += 10;
  if (/[^A-Za-z0-9]/.test(pw)) poolSize += 32;
  const entropyBits = poolSize > 0 ? pw.length * Math.log2(poolSize) : 0;
  let score = 0;
  if (pw.length >= 8) score += 15;
  if (pw.length >= 12) score += 15;
  if (pw.length >= 16) score += 15;
  if (pw.length >= 20) score += 10;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 10;
  if (/[^A-Za-z0-9]/.test(pw)) score += 10;
  if (/(.)\1{2,}/.test(pw)) score -= 10; // repeated runs
  if (/^(.)\1+$/.test(pw)) score -= 20; // single repeated character
  score = Math.max(0, Math.min(100, score));
  const label = score < 30 ? 'Weak' : score < 55 ? 'Fair' : score < 80 ? 'Strong' : 'Very strong';
  return { score, label, entropyBits: Math.round(entropyBits * 10) / 10 };
}

/** Strength meter for the master-password setup screen (same scale). */
export function scoreMasterPassword(password) {
  return scorePassword(password);
}
