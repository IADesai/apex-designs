// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { h } from '../src/scripts/admin/dom';

describe('h()', () => {
  it('renders strings as text, never HTML (Review Focus 3)', () => {
    const el = h('td', {}, '<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('blocks javascript: URLs and string event handlers', () => {
    const a = h('a', { href: 'javascript:alert(1)', onclick: 'alert(1)' as unknown as string }, 'x');
    expect(a.getAttribute('href')).toBeNull();
    expect(a.getAttribute('onclick')).toBeNull();
  });
  it('attaches function handlers', () => {
    const fn = vi.fn();
    const b = h('button', { onclick: fn }, 'Go');
    b.click();
    expect(fn).toHaveBeenCalledOnce();
  });
  it('skips null, false and undefined children and attributes', () => {
    const el = h('p', { title: undefined, hidden: false }, null, false, 'ok', 3);
    expect(el.textContent).toBe('ok3');
    expect(el.hasAttribute('hidden')).toBe(false);
  });
});
