export type PackageId = 'standard' | 'premium' | 'custom';

export interface Package {
  id: PackageId;
  name: string;
  price: string;
  priceNote?: string;
  blurb: string;
  includesFrom?: string;
  features: string[];
  featured?: boolean;
}

export const packages: Package[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: '£300',
    priceNote: 'one-off',
    blurb: 'A sharp, custom single-page site to get your business online properly.',
    features: ['Custom single page website', 'Consultation call', 'Scheduled development plan', 'Free hosting', 'Custom email & logo'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '£500',
    priceNote: '+ £15/month',
    blurb: 'A full multi-page site that gets found on Google and keeps improving.',
    includesFrom: 'Everything in Standard, plus',
    features: ['Custom multi-page website', 'Google Business Profile setup', 'Google Analytics', 'Continuous support'],
    featured: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    price: 'On quote',
    blurb: 'Bespoke systems and brand-led design for businesses that need more.',
    includesFrom: 'Everything in Premium, plus',
    features: ['Custom coded systems', 'Tailored brand-specific designs', 'On-call maintenance', 'Continuous page updates'],
  },
];
