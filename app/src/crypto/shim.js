/**
 * Web / default shim — no-op.
 *
 * On the web the browser provides real WebCrypto, so nothing needs to be
 * installed. On native, Metro resolves `shim.native.js` instead of this
 * file. See polyfill-note.js for the full story.
 */
export {};
