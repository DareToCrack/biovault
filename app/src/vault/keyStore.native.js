/**
 * Secure key store — native implementation (expo-secure-store).
 *
 * Plain storage: values live in the iOS Keychain / Android Keystore-
 * encrypted SharedPreferences. Biometric-gated storage: values are
 * stored with `requireAuthentication: true`, so the OS only releases
 * them after a fingerprint/face match.
 *
 * NOTE: `requireAuthentication` is not supported in Expo Go when
 * biometrics are available (missing NSFaceIDUsageDescription) — a
 * development build with the config plugin in app.json is required
 * for the biometric path. See the README.
 */
import * as SecureStore from 'expo-secure-store';

export const keyStore = {
  async set(key, value) {
    await SecureStore.setItemAsync(key, value);
  },
  async get(key) {
    return SecureStore.getItemAsync(key);
  },
  async delete(key) {
    await SecureStore.deleteItemAsync(key);
  },
  async setAuth(key, value) {
    await SecureStore.setItemAsync(key, value, { requireAuthentication: true });
  },
  async getAuth(key) {
    return SecureStore.getItemAsync(key, { requireAuthentication: true });
  },
  async deleteAuth(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
