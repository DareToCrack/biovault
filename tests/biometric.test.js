import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBiometricStatus, authenticateWithBiometrics, biometricLabel } from '../app/src/auth/biometric.js';

/** Fake expo-local-authentication module. */
function fakeAuth(overrides = {}) {
  return {
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => true,
    supportedAuthenticationTypesAsync: async () => [1],
    authenticateAsync: async () => ({ success: true }),
    ...overrides,
  };
}

const NATIVE = { authModule: fakeAuth(), platformOs: 'ios' };
const WEB = { authModule: fakeAuth(), platformOs: 'web' };

test('getBiometricStatus reports available when hardware + enrollment exist', async () => {
  const s = await getBiometricStatus(NATIVE);
  assert.equal(s.available, true);
  assert.equal(s.enrolled, true);
  assert.deepEqual(s.types, [1]);
});

test('getBiometricStatus reports unavailable on web', async () => {
  const s = await getBiometricStatus(WEB);
  assert.equal(s.available, false);
  assert.match(s.reason, /web/);
});

test('getBiometricStatus reports unavailable when no hardware / nothing enrolled', async () => {
  const noHw = await getBiometricStatus({
    authModule: fakeAuth({ hasHardwareAsync: async () => false, isEnrolledAsync: async () => false }),
    platformOs: 'ios',
  });
  assert.equal(noHw.available, false);
  assert.match(noHw.reason, /hardware/);

  const notEnrolled = await getBiometricStatus({
    authModule: fakeAuth({ isEnrolledAsync: async () => false }),
    platformOs: 'android',
  });
  assert.equal(notEnrolled.available, false);
  assert.match(notEnrolled.reason, /enrolled/);
});

test('getBiometricStatus never throws when the auth module fails', async () => {
  const s = await getBiometricStatus({
    authModule: fakeAuth({ hasHardwareAsync: async () => { throw new Error('boom'); } }),
    platformOs: 'ios',
  });
  assert.equal(s.available, false);
  assert.equal(s.reason, 'boom');
});

test('authenticateWithBiometrics returns success on a good prompt', async () => {
  const r = await authenticateWithBiometrics(NATIVE);
  assert.deepEqual(r, { success: true });
});

test('authenticateWithBiometrics returns a failure object (not a throw) on cancel', async () => {
  const r = await authenticateWithBiometrics({
    authModule: fakeAuth({ authenticateAsync: async () => ({ success: false, error: 'user_cancel' }) }),
    platformOs: 'ios',
  });
  assert.equal(r.success, false);
  assert.equal(r.error, 'user_cancel');
});

test('authenticateWithBiometrics is unavailable on web', async () => {
  const r = await authenticateWithBiometrics(WEB);
  assert.equal(r.success, false);
  assert.match(r.error, /web/);
});

test('biometricLabel names fingerprint, face and iris', () => {
  assert.equal(biometricLabel([1]), 'Fingerprint');
  assert.equal(biometricLabel([2]), 'Face');
  assert.equal(biometricLabel([1, 2]), 'Fingerprint / Face');
  assert.equal(biometricLabel([3]), 'Iris');
  assert.equal(biometricLabel([]), 'Biometrics');
  assert.equal(biometricLabel(null), 'Biometrics');
});
