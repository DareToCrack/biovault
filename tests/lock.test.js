import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldLock, msUntilLock, lockReducer, AUTO_LOCK_AFTER_MS } from '../app/src/vault/lock.js';

test('AUTO_LOCK_AFTER_MS is 2 minutes', () => {
  assert.equal(AUTO_LOCK_AFTER_MS, 2 * 60 * 1000);
});

test('shouldLock: true after 2 minutes of inactivity, false before', () => {
  const now = Date.now();
  assert.equal(shouldLock(now - 2 * 60 * 1000, now), true);
  assert.equal(shouldLock(now - 2 * 60 * 1000 - 1, now), true);
  assert.equal(shouldLock(now - 119 * 1000, now), false);
  assert.equal(shouldLock(null, now), true);
});

test('msUntilLock counts down to zero', () => {
  const now = Date.now();
  assert.equal(msUntilLock(now - 60 * 1000, now), 60 * 1000);
  assert.equal(msUntilLock(now - 3 * 60 * 1000, now), 0);
  assert.equal(msUntilLock(null, now), 0);
});

test('lockReducer: unlock → activity resets the timer → check locks after 2 min', () => {
  const t0 = 1_000_000;
  let state = lockReducer({ status: 'locked', lastActivityAt: null }, { type: 'unlock' }, t0);
  assert.equal(state.status, 'unlocked');
  assert.equal(state.lastActivityAt, t0);

  state = lockReducer(state, { type: 'activity' }, t0 + 90_000);
  assert.equal(state.status, 'unlocked');
  assert.equal(state.lastActivityAt, t0 + 90_000);

  // 100s after the last activity: still unlocked.
  state = lockReducer(state, { type: 'check' }, t0 + 190_000);
  assert.equal(state.status, 'unlocked');

  // 121s after the last activity: locked.
  state = lockReducer(state, { type: 'check' }, t0 + 90_000 + 121_000);
  assert.equal(state.status, 'locked');
  assert.equal(state.lastActivityAt, null);
});

test('lockReducer: explicit lock clears the activity timestamp', () => {
  const state = lockReducer(
    { status: 'unlocked', lastActivityAt: 1_000_000 },
    { type: 'lock' },
  );
  assert.deepEqual(state, { status: 'locked', lastActivityAt: null });
});

test('lockReducer: activity while locked does nothing', () => {
  const state = lockReducer(
    { status: 'locked', lastActivityAt: null },
    { type: 'activity', now: 5_000 },
  );
  assert.deepEqual(state, { status: 'locked', lastActivityAt: null });
});
