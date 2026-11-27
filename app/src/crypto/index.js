/**
 * Crypto entry point. The platform shim loads first (no-op on web,
 * installs the react-native-webcrypto polyfill on native), then the
 * WebCrypto-only core is re-exported unchanged.
 */
import './shim';

export * from './core';
