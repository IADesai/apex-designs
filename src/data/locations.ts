import type { Faq } from './faqs';

export interface Location {
  slug: string;
  place: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string[];
  nearby: string[];
  points: { title: string; text: string }[];
  faqs: Faq[];
  work: string[];
}

export const locations: Location[] = [
  {
    slug: 'web-design-romford',
    place: 'Romford',
    title: 'Web Design Romford',
    description: 'Romford web designer building fast, custom websites for local businesses. Clear prices from £300, one-to-one service, launched on a scheduled plan.',
    eyebrow: 'Based in Romford',
    h1: 'Web design in Romford, from someone down the road',
    intro: [
      'Apex Designs is based in Romford, so when you work with us you are working with a local team. We build custom websites for shops, trades, restaurants and professional services across Havering, from the Market Place and South Street to Gidea Park and Harold Wood.',
      'You deal with us directly from the first conversation to launch day. No account managers, no outsourcing, and no templates dressed up as custom work.',
    ],
    nearby: ['Hornchurch', 'Upminster', 'Gidea Park', 'Harold Wood', 'Collier Row', 'Rainham', 'Elm Park', 'Chadwell Heath'],
    points: [
      { title: 'Meet locally', text: 'Happy to meet in Romford, or keep it to WhatsApp and video calls if that suits you better.' },
      { title: 'Found on local searches', text: 'Pages are built around how Romford customers search, with your Google Business Profile set up on Premium.' },
      { title: 'Clear, local pricing', text: 'Packages from £300, so a professional site is realistic for small Romford businesses.' },
    ],
    faqs: [
      { q: 'Do you meet clients in person in Romford?', a: 'Yes. We are Romford-based and happy to meet locally, though most of the process works well over WhatsApp and video calls.' },
      { q: 'Can you help my Romford business show up on Google Maps?', a: 'Yes. The Premium package includes setting up and optimising your Google Business Profile, which is what powers the map results.' },
    ],
    work: ['whitebeard', 'my-thermomix-my-way'],
  },
  {
    slug: 'web-design-east-london',
    place: 'East London',
    title: 'Web Design East London',
    description: 'Custom websites for East London businesses, from Whitechapel to Stratford and Ilford. Affordable packages, fast sites, and a team that answers the phone.',
    eyebrow: 'Across East London',
    h1: 'Web design for East London businesses that want to stand out',
    intro: [
      'East London moves fast and competition is everywhere. Whether you run a restaurant in Whitechapel, a salon in Stratford or a firm in Ilford, your website is often the first impression, and it has to look the part on a phone in seconds.',
      'We have built sites for East London businesses like Damal, matching their identity and making it simple for customers to find what they need.',
    ],
    nearby: ['Whitechapel', 'Stratford', 'Ilford', 'Barking', 'Dagenham', 'Bethnal Green', 'Walthamstow', 'East Ham', 'Leytonstone'],
    points: [
      { title: 'Built for mobile', text: 'Most of your visitors are on their phone. Every page is designed and tested mobile-first.' },
      { title: 'Personal service', text: 'The same small team from brief to launch, so nothing gets lost between a sales team and a developer.' },
      { title: 'Proven locally', text: 'Restaurant, banqueting and professional-service sites already live for East London clients.' },
    ],
    faqs: [
      { q: 'Which parts of East London do you cover?', a: 'All of it, from Tower Hamlets and Newham to Redbridge, Barking & Dagenham and Waltham Forest. We are based in Romford, just up the road.' },
      { q: 'Do you build restaurant websites?', a: 'Yes. Damal Restaurant and Damal Banqueting are both East London hospitality sites we designed and built.' },
    ],
    work: ['damal-restaurant', 'damal-banqueting'],
  },
  {
    slug: 'web-design-essex',
    place: 'Essex',
    title: 'Web Design Essex',
    description: 'Web design for Essex businesses in Brentwood, Basildon, Chelmsford and beyond. Custom sites from £300, built by a Romford web designer on the Essex border.',
    eyebrow: 'On the Essex border',
    h1: 'Web design for Essex businesses, from the edge of Romford',
    intro: [
      'Romford sits right on the Essex border, so Brentwood, Basildon, Chelmsford and Thurrock are all close to home. We work with Essex businesses that want a modern website without agency prices.',
      'Whether you are a trade covering half the county or a shop on the high street, we will build a site that explains what you do clearly and makes it easy to get in touch.',
    ],
    nearby: ['Brentwood', 'Basildon', 'Chelmsford', 'Billericay', 'Grays', 'Thurrock', 'Southend-on-Sea', 'Epping'],
    points: [
      { title: 'Service-area pages', text: 'Cover the towns you actually work in, so customers searching there can find you.' },
      { title: 'Easy to contact', text: 'Click-to-call, WhatsApp and quote forms placed where customers expect them.' },
      { title: 'Room to grow', text: 'Start with Standard and move up to Premium or Custom as your business grows.' },
    ],
    faqs: [
      { q: 'Do you work with trades and service businesses in Essex?', a: 'Yes. Trades are a great fit: clear services, the areas you cover, reviews and a fast way to request a quote.' },
      { q: 'Is it a problem that you are not in my town?', a: 'Not at all. Most of the process happens over WhatsApp and video calls, and Romford is close enough to meet if needed.' },
    ],
    work: ['whitebeard', 'damal-banqueting'],
  },
  {
    slug: 'remote-web-design-uk',
    place: 'the UK',
    title: 'Remote Web Design UK',
    description: 'A UK web designer who works remotely with businesses anywhere, with clients from East London to Oxford. Clear packages, video calls and WhatsApp updates.',
    eyebrow: 'Anywhere in the UK',
    h1: 'Remote web design for businesses anywhere in the UK',
    intro: [
      'You do not need a local web designer to get a great website. We work with clients well beyond London, including Al Ansaar, a charity in Oxford, and the process is designed to work entirely remotely.',
      'We start with a video call, you get a scheduled plan with dates, and you see progress as it happens, with updates over WhatsApp or email, whichever you prefer.',
    ],
    nearby: ['London', 'Oxford', 'Kent', 'Hertfordshire', 'Surrey', 'Cambridge', 'Birmingham', 'Manchester'],
    points: [
      { title: 'Simple remote process', text: 'Video consultation, shared plan, regular progress links, and launch without leaving your desk.' },
      { title: 'Fast responses', text: 'WhatsApp means quick answers, not tickets waiting in a queue.' },
      { title: 'UK hours, UK pricing', text: 'Same clear packages wherever you are, priced in pounds, no surprises.' },
    ],
    faqs: [
      { q: 'How does working remotely actually work?', a: 'A video call to understand your business, a written plan with dates, then progress links you can open on any device. Feedback goes over WhatsApp or email.' },
      { q: 'Do you have clients outside London?', a: 'Yes, including a client in Oxford. Location makes no difference to how the project runs.' },
    ],
    work: ['al-ansaar', 'whitebeard'],
  },
];
