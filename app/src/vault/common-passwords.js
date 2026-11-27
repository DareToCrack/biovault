/**
 * Curated list of the most commonly breached / guessable passwords.
 * Used ONLY for local weak-password detection — no network lookup.
 * Source: public "most common passwords" lists (e.g. NordPass / SplashData
 * annual lists). Kept deliberately short: the check is a warning, not a
 * breach-database lookup, and the README says so.
 */
export const COMMON_PASSWORDS = [
  '123456', '123456789', '12345678', '12345', '1234567', '123123', '111111',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'abc123',
  '1234', '1234567890', 'iloveyou', 'admin', 'letmein', 'welcome', 'monkey',
  'dragon', 'football', 'sunshine', 'master', 'hello', 'freedom', 'whatever',
  'trustno1', 'superman', 'michael', 'shadow', 'ashley', 'bailey', 'passw0rd',
  'charlie', 'donald', 'jordan', 'tigger', 'secret', 'hunter', 'buster',
  'soccer', 'harley', 'batman', 'andrew', 'jessica', 'pepper', 'daniel',
  '123qwe', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx', 'admin123', 'test123',
  'changeme', 'default', 'guest', 'root', 'toor', 'pass123', 'p@ssw0rd',
  'india123', 'india@123', 'welcome123', 'college123', 'student123',
];

export function isCommonPassword(password) {
  return COMMON_PASSWORDS.includes(String(password || '').toLowerCase());
}
