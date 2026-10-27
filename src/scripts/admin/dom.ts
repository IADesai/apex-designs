type Child = Node | string | number | null | undefined | false;
type Attr = string | boolean | ((e: Event) => void) | undefined;

/** Builds elements with text-only children. CRM data must never go through innerHTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') {
      el.addEventListener(name.replace(/^on/, '').toLowerCase(), value);
      continue;
    }
    if (/^on/i.test(name)) continue; // no inline handlers from strings
    if (value === true) { el.setAttribute(name, ''); continue; }
    if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) continue;
    el.setAttribute(name, value);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
