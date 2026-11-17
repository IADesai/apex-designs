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
  // Google Business Profile ("Apex Designs in Romford"). The CID opens the profile, where reviews are read and written.
  google: { cid: '14034126305284984404', profileUrl: 'https://www.google.com/maps?cid=14034126305284984404' },
  // ICO data protection registration reference (e.g. 'ZB123456'). Shown in the footer and privacy policy once set.
  icoNumber: 'ZC020147' as string,
} as const;

export function hasRealWhatsApp(): boolean {
  return site.whatsapp !== PLACEHOLDER_WHATSAPP;
}
