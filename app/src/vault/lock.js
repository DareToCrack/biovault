/**
 * Auto-lock rules — pure functions, so the behaviour is unit-testable
 * without timers or AppState.
 *
 * Policy: lock after 2 minutes of inactivity, and immediately when the
 * app goes to the background. The App layer owns the timer and the
 * AppState listener; this module owns the decision.
 */

export const AUTO_LOCK_AFTER_MS = 2 * 60 * 1000; // 2 minutes

/** True when the vault should lock due to inactivity. */
export function shouldLock(lastActivityAt, now = Date.now(), timeoutMs = AUTO_LOCK_AFTER_MS) {
  if (!lastActivityAt) return true;
  return now - lastActivityAt >= timeoutMs;
}

/** Milliseconds remaining before auto-lock (0 when already due). */
export function msUntilLock(lastActivityAt, now = Date.now(), timeoutMs = AUTO_LOCK_AFTER_MS) {
  if (!lastActivityAt) return 0;
  return Math.max(0, timeoutMs - (now - lastActivityAt));
}

/**
 * Tiny lock state machine used by the App layer.
 * state: 'locked' | 'unlocked'. Events: 'unlock', 'lock', 'activity'.
 * Activity only matters while unlocked (it refreshes the timer).
 */
export function lockReducer(state, event, now = Date.now()) {
  if (state.status === 'locked') {
    if (event.type === 'unlock') {
      return { status: 'unlocked', lastActivityAt: now };
    }
    return state;
  }
  // unlocked
  if (event.type === 'lock') return { status: 'locked', lastActivityAt: null };
  if (event.type === 'activity') return { ...state, lastActivityAt: now };
  if (event.type === 'check' && shouldLock(state.lastActivityAt, now)) {
    return { status: 'locked', lastActivityAt: null };
  }
  return state;
}
