import type { SafeStorage } from './storage';

export type Consent = 'granted' | 'denied' | null;
export const CONSENT_KEY = 'apex-consent';

export function readConsent(s: SafeStorage): Consent {
  const v = s.get(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export function writeConsent(s: SafeStorage, c: 'granted' | 'denied'): void {
  s.set(CONSENT_KEY, c);
}
