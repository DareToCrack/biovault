import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysePassword, findReused, isStale, analyseVault, STALE_AFTER_DAYS } from '../app/src/vault/health.js';
import { isCommonPassword } from '../app/src/vault/common-passwords.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function entry(overrides = {}) {
  return {
    id: 'e1',
    name: 'Test',
    username: 'u',
    password: 'K7$mQ2vLp9#wXzR4tY',
    url: '',
    category: 'Login',
    notes: '',
    favourite: false,
    createdAt: now - 10 * DAY,
    updatedAt: now - 10 * DAY,
    passwordChangedAt: now - 10 * DAY,
    ...overrides,
  };
}

test('common passwords are detected', () => {
  assert.equal(isCommonPassword('password123'), true);
  assert.equal(isCommonPassword('Password123'), true); // case-insensitive
  assert.equal(isCommonPassword('K7$mQ2vLp9#wXzR4tY'), false);
});

test('analysePassword flags common, short and low-strength passwords', () => {
  assert.equal(analysePassword('password123').weak, true);
  assert.equal(analysePassword('abc123').weak, true);
  assert.equal(analysePassword('K7$mQ2vLp9#wXzR4tY').weak, false);
  const short = analysePassword('Ab1!x');
  assert.equal(short.weak, true);
  assert.ok(short.reasons.some((r) => r.includes('Shorter than')));
});

test('findReused groups entries sharing a password', async () => {
  const entries = [
    entry({ id: 'a', password: 'Same!Pass123' }),
    entry({ id: 'b', password: 'Same!Pass123' }),
    entry({ id: 'c', password: 'Other!Pass456' }),
  ];
  const reused = await findReused(entries);
  assert.equal(reused.length, 1);
  assert.deepEqual([...reused[0].entryIds].sort(), ['a', 'b']);
});

test('findReused returns nothing when all passwords are unique', async () => {
  const entries = [
    entry({ id: 'a', password: 'One!Pass111' }),
    entry({ id: 'b', password: 'Two!Pass222' }),
  ];
  assert.deepEqual(await findReused(entries), []);
});

test('isStale flags passwords older than 180 days, not newer ones', () => {
  assert.equal(isStale(entry({ passwordChangedAt: now - (STALE_AFTER_DAYS + 1) * DAY }), now), true);
  assert.equal(isStale(entry({ passwordChangedAt: now - (STALE_AFTER_DAYS - 1) * DAY }), now), false);
  assert.equal(isStale(entry({ passwordChangedAt: now - 5 * DAY }), now), false);
});

test('analyseVault scores a clean vault at 100', async () => {
  const summary = await analyseVault([
    entry({ id: 'a', password: 'K7$mQ2vLp9#wXzR4tY' }),
    entry({ id: 'b', password: 'Gh!9dF2kL8@pQ4sT' }),
  ]);
  assert.equal(summary.score, 100);
  assert.equal(summary.weakCount, 0);
  assert.equal(summary.reusedCount, 0);
  assert.equal(summary.staleCount, 0);
});

test('analyseVault deducts for weak, reused and stale entries', async () => {
  const summary = await analyseVault([
    entry({ id: 'a', password: 'password123' }), // weak
    entry({ id: 'b', password: 'Same!Pass123' }), // reused (pair)
    entry({ id: 'c', password: 'Same!Pass123' }), // reused (pair)
    entry({ id: 'd', password: 'K7$mQ2vLp9#wXzR4tY', passwordChangedAt: now - 200 * DAY }), // stale
  ]);
  assert.equal(summary.weakCount, 1);
  assert.equal(summary.reusedCount, 2);
  assert.equal(summary.staleCount, 1);
  assert.equal(summary.score, 100 - 15 - 20 - 5);
});

test('analyseVault score never goes below 0', async () => {
  const entries = Array.from({ length: 12 }, (_, i) => entry({ id: `e${i}`, password: 'password123' }));
  const summary = await analyseVault(entries);
  assert.equal(summary.score, 0);
});
