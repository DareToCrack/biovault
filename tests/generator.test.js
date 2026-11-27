import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePassword,
  scorePassword,
  LOWERCASE,
  UPPERCASE,
  DIGITS,
  SYMBOLS,
} from '../app/src/vault/generator.js';

test('generated password has the requested length', () => {
  for (const length of [8, 12, 16, 24, 32]) {
    assert.equal(generatePassword({ length }).length, length);
  }
});

test('generated password contains at least one char from every enabled set', () => {
  for (let i = 0; i < 50; i += 1) {
    const pw = generatePassword({ length: 16 });
    assert.ok([...pw].some((c) => LOWERCASE.includes(c)), 'lowercase present');
    assert.ok([...pw].some((c) => UPPERCASE.includes(c)), 'uppercase present');
    assert.ok([...pw].some((c) => DIGITS.includes(c)), 'digit present');
    assert.ok([...pw].some((c) => SYMBOLS.includes(c)), 'symbol present');
  }
});

test('disabled character sets never appear', () => {
  for (let i = 0; i < 50; i += 1) {
    const pw = generatePassword({ length: 20, symbols: false, uppercase: false });
    assert.ok(![...pw].some((c) => SYMBOLS.includes(c)), 'no symbols');
    assert.ok(![...pw].some((c) => UPPERCASE.includes(c)), 'no uppercase');
    assert.ok([...pw].some((c) => LOWERCASE.includes(c)));
    assert.ok([...pw].some((c) => DIGITS.includes(c)));
  }
});

test('two generated passwords are (almost certainly) different', () => {
  const a = generatePassword({ length: 16 });
  const b = generatePassword({ length: 16 });
  assert.notEqual(a, b);
});

test('generatePassword throws with no character sets enabled', () => {
  assert.throws(
    () => generatePassword({ lowercase: false, uppercase: false, digits: false, symbols: false }),
    /at least one character set/,
  );
});

test('generatePassword throws when length is too short for the enabled sets', () => {
  assert.throws(() => generatePassword({ length: 2 }), /too short/);
});

test('scorePassword: weak for short/simple, very strong for long/mixed', () => {
  assert.equal(scorePassword('abc').label, 'Weak');
  assert.ok(scorePassword('abc').score < 30);
  const strong = scorePassword('K7$mQ2vLp9#wXzR4tY');
  assert.equal(strong.label, 'Very strong');
  assert.ok(strong.score >= 80);
  assert.ok(strong.entropyBits > 100);
});

test('scorePassword penalises repeated characters', () => {
  assert.ok(scorePassword('aaaaaaaaaaaa').score < scorePassword('aB3!xQ9#mZ2$').score);
});

test('scorePassword handles empty input', () => {
  const r = scorePassword('');
  assert.equal(r.score, 0);
  assert.equal(r.label, 'Weak');
});
