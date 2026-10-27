// The ONLY place for contact details. Replace the two values marked SET ME before launch.
export const PLACEHOLDER_WHATSAPP = '447000000000';

export const site = {
  name: 'Apex Designs',
  url: 'https://apexdesigns.org.uk',
  tagline: 'Websites that click!',
  founder: 'Ibrahim',
  email: 'hello@apexdesigns.org.uk', // SET ME: your Hostinger mailbox
  whatsapp: PLACEHOLDER_WHATSAPP as string, // SET ME: international format, digits only, e.g. 447912345678
  base: { locality: 'Romford', borough: 'Havering', region: 'Greater London', country: 'GB' },
  areasServed: ['Romford', 'Havering', 'East London', 'Essex', 'London', 'United Kingdom'],
  social: { instagram: '', linkedin: '' },
} as const;

export function hasRealWhatsApp(): boolean {
  return site.whatsapp !== PLACEHOLDER_WHATSAPP;
}
