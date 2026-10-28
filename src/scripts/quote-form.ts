import { tracker } from './analytics';
import { createLeadSubmitter, leadEndpoint, buildMailto } from '../lib/lead-submit';
import { validateLead, PACKAGE_CHOICES } from '../../supabase/functions/_shared/lead.ts';
import { site } from '../config/site';

const form = document.querySelector<HTMLFormElement>('#quote-form');

if (form) {
  const renderedAt = performance.now();
  const status = form.querySelector<HTMLElement>('[data-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submit = createLeadSubmitter(leadEndpoint(import.meta.env.PUBLIC_SUPABASE_URL), (input, init) => fetch(input, init));

  const pre = new URLSearchParams(window.location.search).get('package');
  const select = form.elements.namedItem('package');
  if (select instanceof HTMLSelectElement && pre && (PACKAGE_CHOICES as readonly string[]).includes(pre)) select.value = pre;

  let started = false;
  form.addEventListener('input', () => {
    if (!started) { started = true; tracker.track('form_start'); }
  });

  const showErrors = (errors: Record<string, string>) => {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
      const field = el.dataset.errorFor ?? '';
      const msg = errors[field] ?? '';
      el.textContent = msg;
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLElement) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
    const first = Object.keys(errors)[0];
    const firstInput = first ? form.elements.namedItem(first) : null;
    if (firstInput instanceof HTMLElement) firstInput.focus();
  };

  const setState = (state: 'idle' | 'sending' | 'sent' | 'error', msg = '') => {
    form.dataset.state = state;
    if (status) status.textContent = msg;
    if (button) button.disabled = state === 'sending' || state === 'sent';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.state === 'sending' || form.dataset.state === 'sent') return;

    const fields = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const check = validateLead({ ...fields, hp: '', elapsed: Number.MAX_SAFE_INTEGER });
    if (!check.ok && !check.spam) { showErrors(check.errors); return; }
    showErrors({});

    setState('sending', 'Sending…');
    const elapsed = Math.round(performance.now() - renderedAt);
    const out = await submit({ ...fields, elapsed, ...tracker.leadContext() });

    if (out.ok) { setState('sent', 'Thanks! Your message is with us and we will get back to you soon.'); form.reset(); return; }
    if (out.kind === 'busy') return;
    if (out.kind === 'invalid') { setState('idle'); showErrors(out.errors); return; }
    if (out.kind === 'unconfigured') {
      const { hp: _hp, ...visible } = fields;
      setState('idle', 'Opening your email app…');
      window.location.href = buildMailto(site.email, visible);
      return;
    }
    setState('error', 'Sorry, that did not send. Please message us on WhatsApp or by email using the links alongside.');
  });
}
