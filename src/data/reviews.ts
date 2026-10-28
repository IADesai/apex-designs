export interface Review {
  author: string;
  text: string;
  rating: 1 | 2 | 3 | 4 | 5;
  source: 'Google';
  context?: string;
}

// Verbatim from the Google profile shown on the old site. Ratings: confirm each is 5★ on Google.
export const reviews: Review[] = [
  { author: 'Ayub Desai', rating: 5, source: 'Google', text: 'Outstanding service from [Apex Designs] while building my website.' },
  { author: 'Imran A', rating: 5, source: 'Google', text: 'We worked with Apex to get our website revamped - excellent choice!! We are really happy with the end product.' },
  { author: 'Mohamoud Abdi', rating: 5, source: 'Google', context: 'Damal', text: 'On behalf of Damal, great work, great service would recommend good brother 24/7 service.' },
  { author: 'Talhah Chowdhury', rating: 5, source: 'Google', text: 'Very good service, tasks are completed quickly while maintaining a high standard' },
  { author: 'Aftab Hafiz', rating: 5, source: 'Google', text: 'Excellent knowledge and very quick' },
];
