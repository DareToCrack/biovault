/**
 * WebCrypto on React Native — why this app's crypto works on web and
 * what native needs.
 *
 * The crypto in core.js uses ONLY `globalThis.crypto.subtle` (WebCrypto).
 * That is available in:
 *   - all modern browsers (Expo web target) — the verified target of this app
 *   - Node 19+ (globalThis.crypto) — used by the test suite
 *
 * It is NOT available in raw React Native (Hermes / JavaScriptCore on
 * iOS and Android): those runtimes ship no WebCrypto implementation, and
 * `getSubtle()` in core.js throws a clear error instead of silently
 * failing.
 *
 * To run this app's crypto on native, this project installs the shim
 * (see shim.native.js, resolved by Metro on iOS/Android only):
 *
 *   - `react-native-get-random-values` — secure randomness for the shim.
 *   - `react-native-webcrypto` — a WebCrypto implementation backed by
 *     native crypto, installed onto `globalThis.crypto` before core.js
 *     loads, so the core runs unchanged.
 *
 * Because the shim is a native module, the native app needs a development
 * build (`npx expo run:ios|android` or EAS) — it does not work in Expo Go.
 * The web export is unaffected: shim.native.js is never bundled for web.
 *
 * `expo-crypto` was NOT used: it provides digests and random bytes only,
 * not AES-GCM, so it cannot power this module on its own.
 *
 * Whichever platform you run on, keep the crypto contract intact:
 * AES-256-GCM, PBKDF2-SHA-256 (600k iterations), one random vault key
 * wrapped by the master-password-derived KEK, keys never logged and
 * never persisted in plaintext, no plaintext passwords in SQLite.
 */

// This file is documentation only; it exports nothing.
export {};
