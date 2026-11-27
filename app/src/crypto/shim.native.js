/**
 * Native WebCrypto shim (Metro resolves this file instead of shim.js on
 * iOS/Android only — it is never bundled for web).
 *
 * Hermes / JavaScriptCore ship no WebCrypto. This file installs the
 * `react-native-webcrypto` polyfill (plus `react-native-get-random-values`
 * for secure randomness) onto `globalThis.crypto` before the crypto core
 * loads, so `core.js` runs unchanged on native.
 *
 * Both packages are declared dependencies of the app. If they are ever
 * removed, the require below throws a clear error instead of failing
 * silently — the vault must never fall back to a weak RNG.
 */
try {
  // eslint-disable-next-line global-require
  require('react-native-get-random-values');
  // eslint-disable-next-line global-require
  const { Crypto } = require('react-native-webcrypto');
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    globalThis.crypto = new Crypto();
  }
} catch (e) {
  throw new Error(
    'BioVault needs a WebCrypto implementation on native. Install react-native-webcrypto and react-native-get-random-values, then use a development build (see polyfill-note.js). Original error: ' +
      (e && e.message ? e.message : String(e)),
  );
}

export {};
