/**
 * Biometric authentication wrapper.
 *
 * This module imports NO Expo or React Native code at the top level, so
 * it is unit-testable in plain Node: the auth module and the platform
 * are injected by the caller. The app passes the real
 * `expo-local-authentication` module and `Platform.OS`; tests pass fakes.
 *
 * On web there is no biometric hardware — every call reports
 * unavailable instead of throwing.
 */

/** What biometrics can this device do? Never throws. */
export async function getBiometricStatus({ authModule, platformOs }) {
  if (platformOs === 'web') {
    return { available: false, enrolled: false, types: [], reason: 'Biometrics are not available on web' };
  }
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      authModule.hasHardwareAsync(),
      authModule.isEnrolledAsync(),
      authModule.supportedAuthenticationTypesAsync(),
    ]);
    return {
      available: Boolean(hasHardware && enrolled),
      enrolled: Boolean(enrolled),
      types: types || [],
      reason: !hasHardware
        ? 'This device has no biometric hardware'
        : !enrolled
          ? 'No fingerprint or face is enrolled on this device'
          : null,
    };
  } catch (e) {
    return { available: false, enrolled: false, types: [], reason: e?.message || 'Biometric check failed' };
  }
}

/**
 * Run the OS biometric prompt. Returns { success: true } or
 * { success: false, error } — never throws for a user cancel.
 */
export async function authenticateWithBiometrics(
  { authModule, platformOs },
  promptMessage = 'Unlock BioVault',
) {
  if (platformOs === 'web') {
    return { success: false, error: 'Biometrics are not available on web' };
  }
  try {
    const result = await authModule.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use master password instead',
      disableDeviceFallback: false,
    });
    if (result.success) return { success: true };
    return { success: false, error: result.error || 'Authentication failed' };
  } catch (e) {
    return { success: false, error: e?.message || 'Authentication failed' };
  }
}

/** Human-readable name for the enrolled biometric type(s). */
export function biometricLabel(types) {
  if (!types || types.length === 0) return 'Biometrics';
  const names = [];
  if (types.includes(1)) names.push('Fingerprint');
  if (types.includes(2)) names.push('Face');
  if (types.includes(3)) names.push('Iris');
  return names.length > 0 ? names.join(' / ') : 'Biometrics';
}
