import { describe, it, expect } from 'vitest';
import { whatsappUrl } from '../src/lib/whatsapp';

describe('whatsappUrl', () => {
  it('builds a wa.me link with encoded text', () => {
    expect(whatsappUrl('447912345678', 'Hi Ibrahim & team')).toBe('https://wa.me/447912345678?text=Hi%20Ibrahim%20%26%20team');
  });
  it('strips non-digits from the number', () => {
    expect(whatsappUrl('+44 7912 345678')).toBe('https://wa.me/447912345678');
  });
});
