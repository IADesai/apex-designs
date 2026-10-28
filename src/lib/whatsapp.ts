export function whatsappUrl(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const DEFAULT_WA_TEXT = "Hi Apex Designs, I'd like to chat about a website.";
