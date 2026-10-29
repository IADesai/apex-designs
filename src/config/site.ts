// The ONLY place for contact details.
export const PLACEHOLDER_WHATSAPP = '447000000000';

export const site = {
  name: 'Apex Designs',
  url: 'https://apexdesigns.org.uk',
  tagline: 'Websites that click!',
  email: 'info@apexdesigns.org.uk',
  whatsapp: '447486600030' as string, // international format, digits only
  base: { locality: 'Romford', borough: 'Havering', region: 'Greater London', country: 'GB' },
  areasServed: ['Romford', 'Havering', 'East London', 'Essex', 'London', 'United Kingdom'],
  instagramHandle: 'apexdesigns.ig',
  social: { instagram: 'https://www.instagram.com/apexdesigns.ig/', linkedin: '' },
} as const;

export function hasRealWhatsApp(): boolean {
  return site.whatsapp !== PLACEHOLDER_WHATSAPP;
}
