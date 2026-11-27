/**
 * Vault health analysis — pure functions, all local, no network.
 * Works on decrypted entries (in memory only). Passwords are hashed
 * (SHA-256) for the reuse comparison — the plaintext is never stored
 * anywhere by this module.
 *
 * Rules:
 *  - weak: password is in the common-password list, OR shorter than 10
 *    characters, OR scores below 30 on the generator's strength scale.
 *  - reused: two or more entries share the same password.
 *  - stale: the password has not been changed in more than 180 days.
 */
import { scorePassword } from './generator.js';
import { isCommonPassword } from './common-passwords.js';
import { sha256Hex } from '../crypto/core.js';

export const STALE_AFTER_DAYS = 180;
export const MIN_HEALTHY_LENGTH = 10;
export const WEAK_SCORE_BELOW = 30;

/** Analyse one entry's password. Returns { weak, reasons[] }. */
export function analysePassword(password) {
  const pw = String(password || '');
  const reasons = [];
  if (isCommonPassword(pw)) reasons.push('This password is one of the most commonly used passwords');
  if (pw.length < MIN_HEALTHY_LENGTH) reasons.push(`Shorter than ${MIN_HEALTHY_LENGTH} characters`);
  const { score } = scorePassword(pw);
  if (score < WEAK_SCORE_BELOW) reasons.push('Low strength score');
  return { weak: reasons.length > 0, reasons, score };
}

/** Find reused passwords across entries. Returns an array of { passwordHash, entryIds }. */
export async function findReused(entries) {
  const byHash = new Map();
  for (const entry of entries) {
    const hash = await sha256Hex(entry.password || '');
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(entry.id);
  }
  const reused = [];
  for (const [passwordHash, entryIds] of byHash) {
    if (entryIds.length > 1) reused.push({ passwordHash, entryIds });
  }
  return reused;
}

/** Is this entry's password stale? (older than STALE_AFTER_DAYS). */
export function isStale(entry, now = Date.now()) {
  const changedAt = entry.passwordChangedAt || entry.updatedAt || entry.createdAt || 0;
  const ageDays = (now - changedAt) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_AFTER_DAYS;
}

/**
 * Full vault health summary. Returns:
 * { total, weakCount, reusedCount, staleCount, score, weakIds, reusedGroups, staleIds }
 * Score: 100 minus 15 per weak entry, 10 per reused entry, 5 per stale
 * entry (floor 0). The rule is documented in the README.
 */
export async function analyseVault(entries, now = Date.now()) {
  const weakIds = [];
  for (const entry of entries) {
    if (analysePassword(entry.password).weak) weakIds.push(entry.id);
  }
  const reusedGroups = await findReused(entries);
  const reusedIds = new Set(reusedGroups.flatMap((g) => g.entryIds));
  const staleIds = entries.filter((e) => isStale(e, now)).map((e) => e.id);
  const score = Math.max(
    0,
    100 - weakIds.length * 15 - reusedIds.size * 10 - staleIds.length * 5,
  );
  return {
    total: entries.length,
    weakCount: weakIds.length,
    reusedCount: reusedIds.size,
    staleCount: staleIds.length,
    score,
    weakIds,
    reusedGroups,
    staleIds,
  };
}
