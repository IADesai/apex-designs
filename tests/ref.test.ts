import { describe, it, expect } from 'vitest';
import { sanitizeRef, REF_PATTERN } from '../supabase/functions/_shared/ref.ts';

describe('sanitizeRef', () => {
  it('normalises human labels to slugs', () => {
    expect(sanitizeRef('Romford Traders!')).toBe('romford-traders');
    expect(sanitizeRef('  WA_Group-2 ')).toBe('wa_group-2');
  });
  it('neutralises HTML', () => {
    const s = sanitizeRef('<script>alert(1)</script>');
    expect(s).toBe('script-alert-1-script');
    expect(s).toMatch(REF_PATTERN);
  });
  it('drops values with nothing usable', () => {
    expect(sanitizeRef('🔥🔥')).toBeNull();
    expect(sanitizeRef('---')).toBeNull();
    expect(sanitizeRef('')).toBeNull();
    expect(sanitizeRef(null)).toBeNull();
    expect(sanitizeRef(42)).toBeNull();
  });
  it('truncates long values to 64 chars', () => {
    const s = sanitizeRef('a'.repeat(500));
    expect(s).toHaveLength(64);
    expect(s).toMatch(REF_PATTERN);
  });
});
