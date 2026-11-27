/**
 * Demo vault — seeded sample entries for the demo mode and screenshots.
 * All data is fictional. The set is designed to exercise the health
 * analysis: 1 weak password, 1 reused pair, 1 stale password.
 *
 * Timestamps are relative to "now" so the demo is stable whenever it runs.
 */

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days) {
  return Date.now() - days * DAY;
}

export const DEMO_ENTRIES = [
  {
    id: 'demo-gmail',
    name: 'Gmail',
    username: 'jyothsna6125@gmail.com',
    password: 'K7$mQ2vLp9#wXzR4tY',
    url: 'https://mail.google.com',
    category: 'Login',
    notes: 'Main email account.',
    favourite: true,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(12),
    passwordChangedAt: daysAgo(12),
  },
  {
    id: 'demo-github',
    name: 'GitHub',
    username: 'DareToCrack',
    password: 'Gh!9dF2kL8@pQ4sT',
    url: 'https://github.com',
    category: 'Work',
    notes: 'Portfolio and projects.',
    favourite: true,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(30),
    passwordChangedAt: daysAgo(30),
  },
  {
    id: 'demo-linkedin',
    name: 'LinkedIn',
    username: 'pottajyothsna@gmail.com',
    password: 'Ln#5vB8nM2$xW7qK',
    url: 'https://www.linkedin.com',
    category: 'Social',
    notes: '',
    favourite: false,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(45),
    passwordChangedAt: daysAgo(45),
  },
  {
    id: 'demo-netflix',
    name: 'Netflix',
    username: 'jyothsna6125@gmail.com',
    password: 'Stream!2024Family',
    url: 'https://www.netflix.com',
    category: 'Social',
    notes: 'Shared with family — same password as Amazon (demo of reuse).',
    favourite: false,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(60),
    passwordChangedAt: daysAgo(60),
  },
  {
    id: 'demo-amazon',
    name: 'Amazon',
    username: 'jyothsna6125@gmail.com',
    password: 'Stream!2024Family',
    url: 'https://www.amazon.in',
    category: 'Finance',
    notes: 'Same password as Netflix — reuse warning on purpose.',
    favourite: false,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(60),
    passwordChangedAt: daysAgo(60),
  },
  {
    id: 'demo-wifi',
    name: 'College Wi-Fi',
    username: 'jyothsna6125',
    password: 'password123',
    url: '',
    category: 'Wi-Fi',
    notes: 'Weak on purpose — demo of the weak-password warning.',
    favourite: false,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(90),
    passwordChangedAt: daysAgo(90),
  },
  {
    id: 'demo-bank',
    name: 'Bank Account',
    username: 'jyothsna6125',
    password: 'Bk$8mN3pL6#vQ9wX',
    url: 'https://www.onlinesbi.sbi',
    category: 'Finance',
    notes: 'Password not changed in 8 months — demo of the stale warning.',
    favourite: true,
    createdAt: daysAgo(240),
    updatedAt: daysAgo(240),
    passwordChangedAt: daysAgo(240),
  },
  {
    id: 'demo-vpn',
    name: 'Work VPN',
    username: 'jyothsna6125',
    password: 'Vp!4kR8tY2#mN6qZ',
    url: '',
    category: 'Work',
    notes: '',
    favourite: false,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(20),
    passwordChangedAt: daysAgo(20),
  },
];

export const DEMO_CATEGORIES = ['Login', 'Finance', 'Social', 'Work', 'Wi-Fi', 'Other'];

/** Demo master password (shown on the demo lock screen). */
export const DEMO_MASTER_PASSWORD = 'demo-master-123';
