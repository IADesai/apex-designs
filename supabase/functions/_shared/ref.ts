// Shared by the website (Vite) and the Edge Function (Deno). No imports allowed.
export const REF_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function sanitizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, 64)
    .replace(/[-_]+$/, '');
  return REF_PATTERN.test(s) ? s : null;
}
