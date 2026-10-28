// The ONLY place for contact details. Replace the two values marked SET ME before launch.
export const PLACEHOLDER_WHATSAPP = '447000000000';

export const site = {
  name: 'Apex Designs',
  url: 'https://apexdesigns.org.uk',
  tagline: 'Websites that click!',
  email: 'hello@apexdesigns.org.uk', // SET ME: your Hostinger mailbox
  whatsapp: '447486600030' as string, // international format, digits only
  base: { locality: 'Romford', borough: 'Havering', region: 'Greater London', country: 'GB' },
  areasServed: ['Romford', 'Havering', 'East London', 'Essex', 'London', 'United Kingdom'],
  social: { instagram: '', linkedin: '' },
} as const;

export function hasRealWhatsApp(): boolean {
  return site.whatsapp !== PLACEHOLDER_WHATSAPP;
}
