// Dashboard views for client change requests: review, approve, then hand the work to Claude.
import type { Api, Client } from './api';
import { h } from './dom';
import { portalUrl } from '../../lib/admin-helpers';
import { buildClaudePrompt, claudeLink } from '../../lib/change-prompt';
import { KIND_LABELS, URGENCY_LABELS } from '../../lib/change-chat';
import { CHANGE_STATUSES, type ChangeStatus } from '../../../supabase/functions/_shared/change.ts';
import { site } from '../../config/site';

const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const view = () => document.getElementById('view');
const errorBox = (text: string) => h('p', { class: 'error', role: 'alert' }, text);

const STATUS_LABELS: Record<ChangeStatus, string> = {
  new: 'Needs review',
  approved: 'Approved',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
};

function copyButton(text: () => string, label: string, cls = 'btn btn-ghost'): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button' }, label);
  b.addEventListener('click', () => {
    if (!navigator.clipboard) { b.textContent = 'Copy not supported'; return; }
    navigator.clipboard.writeText(text()).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Copy failed'; });
  });
  return b;
}

const pill = (status: ChangeStatus) => h('span', { class: 'pill', 'data-status': status }, STATUS_LABELS[status]);

export async function requestsView(api: Api, status?: ChangeStatus): Promise<HTMLElement> {
  const requests = await api.requests(status);
  const filter = h('select', {
    'aria-label': 'Filter by status',
    onchange: async (e: Event) => {
      const v = (e.target as HTMLSelectElement).value as ChangeStatus | '';
      try { view()?.replaceChildren(await requestsView(api, v || undefined)); } catch (err) { view()?.replaceChildren(errorBox(msg(err))); }
    },
  }, h('option', { value: '' }, 'All statuses'), ...CHANGE_STATUSES.map((s) => h('option', { value: s, selected: s === status }, STATUS_LABELS[s])));

  const head = h('div', { class: 'toolbar' }, h('h2', {}, `Change requests (${requests.length})`), filter);
  if (!requests.length) return h('section', {}, head, h('p', { class: 'muted' }, 'No requests yet. Add a client and send them their portal link.'));

  const rows = requests.map((r) => h('tr', {},
    h('td', {}, fmt.format(new Date(r.created_at))),
    h('td', {}, r.clients?.business ?? '–'),
    h('td', {}, h('a', { href: `#request=${r.id}` }, r.title)),
    h('td', {}, URGENCY_LABELS[r.urgency]),
    h('td', {}, pill(r.status))));
  return h('section', {}, head, h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, ...['Received', 'Client', 'Request', 'When', 'Status'].map((t) => h('th', {}, t)))),
    h('tbody', {}, ...rows))));
}

export async function requestDetail(api: Api, id: string): Promise<HTMLElement> {
  const req = await api.request(id);
  if (!req) return h('section', {}, h('a', { href: '#tab=requests' }, '← All requests'), h('p', {}, 'Request not found.'));

  const reply = h('textarea', { rows: '3', maxlength: '1000', 'aria-label': 'Reply shown to the client' });
  reply.value = req.reply ?? '';
  const notes = h('textarea', { rows: '4', maxlength: '5000', 'aria-label': 'Private notes' });
  notes.value = req.notes ?? '';
  const saved = h('span', { class: 'muted', role: 'status' });
  const statusSlot = h('span', {}, pill(req.status));
  const promptSlot = h('div', {});
  const actions = h('div', { class: 'row' });

  const prompt = () => buildClaudePrompt(
    req.clients ?? { name: 'the client', business: 'the client', site_url: null, context: null },
    { title: req.title, kind: req.kind, page: req.page, details: req.details, urgency: req.urgency, notes: notes.value },
  );

  // The prompt only appears once the request is approved, so nothing gets actioned by accident.
  const renderPrompt = () => {
    if (req.status !== 'approved' && req.status !== 'in_progress') {
      promptSlot.replaceChildren(h('p', { class: 'muted' }, req.status === 'new' ? 'Approve the request to generate the Claude prompt.' : 'No prompt for this status.'));
      return;
    }
    const text = prompt();
    const link = claudeLink(text);
    const box = h('textarea', { rows: '14', readonly: true, class: 'mono', 'aria-label': 'Prompt for Claude' });
    box.value = text;
    promptSlot.replaceChildren(
      box,
      h('div', { class: 'row' },
        copyButton(() => box.value, 'Copy prompt for Claude', 'btn btn-primary'),
        link ? h('a', { class: 'btn btn-ghost', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Open in Claude') : null),
      h('p', { class: 'muted' }, 'Paste it into Claude Code in the client\'s project. "Open in Claude" sends the prompt text to claude.ai.'));
  };

  const setStatus = async (next: ChangeStatus) => {
    saved.textContent = 'Saving…';
    try {
      await api.updateRequest(req.id, { status: next, reply: reply.value.trim() || null, notes: notes.value.trim() || null });
      req.status = next;
      statusSlot.replaceChildren(pill(next));
      saved.textContent = 'Saved';
      renderPrompt();
      renderActions();
    } catch (e) { saved.textContent = `Not saved: ${msg(e)}`; }
  };

  const action = (label: string, next: ChangeStatus, cls = 'btn btn-ghost') => h('button', { class: cls, type: 'button', onclick: () => { void setStatus(next); } }, label);
  function renderActions(): void {
    const s = req!.status;
    const buttons =
      s === 'new' ? [action('Approve', 'approved', 'btn btn-primary'), action('Decline', 'declined')]
      : s === 'approved' ? [action('Mark in progress', 'in_progress', 'btn btn-primary'), action('Mark done', 'done'), action('Decline', 'declined')]
      : s === 'in_progress' ? [action('Mark done', 'done', 'btn btn-primary'), action('Back to approved', 'approved')]
      : [action('Reopen', 'new')];
    actions.replaceChildren(...buttons, action('Save reply and notes', s), saved);
  }

  const pair = (k: string, v: Node | string) => [h('dt', {}, k), h('dd', {}, v)];
  const facts = h('dl', { class: 'facts' },
    ...pair('Client', `${req.clients?.name ?? '–'} · ${req.clients?.business ?? '–'}`),
    ...pair('Site', req.clients?.site_url ? h('a', { href: req.clients.site_url, target: '_blank', rel: 'noopener noreferrer' }, req.clients.site_url) : '–'),
    ...pair('Type', KIND_LABELS[req.kind]),
    ...pair('Where', req.page ?? '–'),
    ...pair('When', URGENCY_LABELS[req.urgency]),
    ...pair('Received', fmt.format(new Date(req.created_at))),
    ...pair('Status', statusSlot));

  const transcript = req.transcript?.length
    ? h('ol', { class: 'timeline' }, ...req.transcript.map((l) => h('li', {}, h('strong', {}, l.from === 'agent' ? 'Assistant: ' : 'Client: '), h('span', { class: 'pre' }, l.text))))
    : h('p', { class: 'muted' }, 'No conversation saved.');

  renderPrompt();
  renderActions();
  return h('section', { class: 'detail' },
    h('a', { href: '#tab=requests' }, '← All requests'),
    h('h2', {}, req.title),
    h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, facts,
        h('h3', {}, 'Details'), h('p', { class: 'pre' }, req.details),
        h('h3', {}, 'Reply to client'), h('p', { class: 'muted' }, 'Shown on their portal next to this request.'), reply,
        h('h3', {}, 'Private notes'), h('p', { class: 'muted' }, 'Added to the Claude prompt.'), notes,
        actions),
      h('div', { class: 'card' }, h('h3', {}, 'Action with Claude'), promptSlot, h('h3', {}, 'Conversation'), transcript)));
}

export async function clientsView(api: Api): Promise<HTMLElement> {
  const clients = await api.clients();
  const name = h('input', { name: 'name', required: true, maxlength: '100', autocomplete: 'off' });
  const business = h('input', { name: 'business', required: true, maxlength: '120', autocomplete: 'off' });
  const email = h('input', { name: 'email', type: 'email', maxlength: '200', autocomplete: 'off' });
  const siteUrl = h('input', { name: 'site_url', type: 'url', maxlength: '200', placeholder: 'https://' });
  const context = h('textarea', { name: 'context', rows: '3', maxlength: '2000', placeholder: 'Repo, stack, hosting, brand rules: anything Claude should know before touching this site.' });
  const status = h('p', { class: 'muted', role: 'status' });

  const form = h('form', {
    class: 'card',
    onsubmit: async (e: Event) => {
      e.preventDefault();
      const url = siteUrl.value.trim();
      if (url && !/^https?:\/\/\S+$/.test(url)) { status.textContent = 'The website must start with http:// or https://.'; return; }
      status.textContent = 'Adding…';
      try {
        await api.createClient({ name: name.value.trim(), business: business.value.trim(), email: email.value.trim().toLowerCase() || null, site_url: url || null, context: context.value.trim() || null });
        view()?.replaceChildren(await clientsView(api));
      } catch (err) { status.textContent = `Could not add client: ${msg(err)}`; }
    },
  },
    h('h2', {}, 'New client'),
    h('div', { class: 'row' }, h('label', {}, 'Contact name', name), h('label', {}, 'Business', business)),
    h('div', { class: 'row' }, h('label', {}, 'Email (optional)', email), h('label', {}, 'Website (optional)', siteUrl)),
    h('label', {}, 'Project notes for Claude (optional)', context),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add client'),
    status);

  const card = (c: Client) => {
    const link = portalUrl(site.url, c.token);
    const state = h('span', { class: 'muted', role: 'status' });
    const toggle = h('button', {
      class: 'btn btn-ghost', type: 'button',
      onclick: async () => {
        try { await api.updateClient(c.id, { active: !c.active }); view()?.replaceChildren(await clientsView(api)); }
        catch (e) { state.textContent = `Not saved: ${msg(e)}`; }
      },
    }, c.active ? 'Turn link off' : 'Turn link on');
    return h('article', { class: 'card link' },
      h('h3', {}, `${c.business} · ${c.name}`),
      h('p', { class: 'muted' }, c.active ? 'Portal link is live. Anyone with it can send requests as this client, so share it privately.' : 'Portal link is switched off.'),
      h('div', { class: 'row' },
        copyButton(() => link, 'Copy portal link'),
        copyButton(() => `Hi ${c.name.split(/\s+/)[0]}, here is your private link for requesting changes to your website. You can type or talk to it: ${link}`, 'Copy message for client'),
        toggle, state));
  };

  return h('section', {}, form, h('h2', {}, `Clients (${clients.length})`), ...(clients.length ? clients.map(card) : [h('p', { class: 'muted' }, 'No clients yet.')]));
}
