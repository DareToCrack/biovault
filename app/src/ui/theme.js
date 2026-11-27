/**
 * Shared light palette — "normal human colors".
 * Same palette as PhishSim, SecureShare, Privacy Scanner and URL Sentinel:
 * warm off-white background, white cards, dark readable text, one calm blue.
 */

export const colors = {
  bg: '#f7f7f4',
  surface: '#ffffff',
  border: '#e7e4de',
  text: '#22262b',
  muted: '#667085',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  successText: '#15803d',
  successBg: '#f0fdf4',
  warningText: '#92400e',
  warningBg: '#fef3c7',
  dangerText: '#b91c1c',
  dangerBg: '#fef2f2',
  infoText: '#1e3a5f',
  infoBg: '#eff6ff',
  // Health / severity colors.
  severity: {
    weak: '#b91c1c',
    reused: '#b45309',
    stale: '#92400e',
    ok: '#15803d',
  },
  category: {
    Login: '#2563eb',
    Finance: '#15803d',
    Social: '#0e7490',
    Work: '#1d4ed8',
    'Wi-Fi': '#0284c7',
    Other: '#667085',
  },
};

export const layout = {
  maxWidth: 720,
  radius: 12,
};
