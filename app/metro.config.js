/** @type {import('expo/metro-config').MetroConfig} */
import { getDefaultConfig } from 'expo/metro-config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = getDefaultConfig(__dirname);

// Add wasm asset support (expo-sqlite on web uses wa-sqlite)
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to support SharedArrayBuffer (expo-sqlite web)
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

export default config;
