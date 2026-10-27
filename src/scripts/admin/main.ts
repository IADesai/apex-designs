import { createApi, type Api, type Lead } from './api';
import { h } from './dom';
import { LEAD_STATUSES, CHANNELS, trackedUrl, shareText, conversionRate, eventLabel, sortJourney, leadIdFromHash, slugFromLabel, type LeadStatus } from '../../lib/admin-helpers';
import { site } from '../../config/site';

const root = document.getElementById('admin');
const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const show = (...nodes: Node[]) => root?.replaceChildren(...nodes);
const view = () => document.getElementById('view');
const errorBox = (text: string) => h('p', { class: 'error', role: 'alert' }, text);

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  show(errorBox('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY, then rebuild.'));
} else {
  const api = createApi(url, key);
  api.db.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') void route(api);
  });
  window.addEventListener('hashchange', () => { void route(api); });
}

async function route(api: Api): Promise<void> {
  const session = await api.session();
  if (!session) { show(loginView(api)); return; }

  let admin = false;
  try { admin = await api.isAdmin(); } catch (e) { show(errorBox(`Could not check access: ${msg(e)}`)); return; }
  if (!admin) {
    show(h('div', { class: 'card' },
      h('h2', {}, 'Not authorised'),
      h('p', {}, `${session.user.email ?? 'This account'} is not on the admin list.`),
      h('button', { class: 'btn btn-ghost', onclick: () => { void api.signOut(); } }, 'Sign out')));
    return;
  }

  const leadId = leadIdFromHash(window.location.hash);
  const tab = leadId ? 'leads' : new URLSearchParams(window.location.hash.slice(1)).get('tab') ?? 'leads';
  show(nav(api, tab), h('div', { id: 'view' }, h('p', { class: 'muted' }, 'Loading…')));
  try {
    const content = leadId ? await leadDetail(api, leadId)
      : tab === 'links' ? await linksView(api)
      : tab === 'overview' ? await overviewView(api)
      : await leadsView(api);
    view()?.replaceChildren(content);
  } catch (e) {
    view()?.replaceChildren(errorBox(`Could not load data: ${msg(e)}`));
  }
}

function loginView(api: Api): HTMLElement {
  const input = h('input', { type: 'email', name: 'email', required: true, autocomplete: 'email' });
  const status = h('p', { class: 'muted', role: 'status' });
  return h('form', {
    class: 'card login',
    onsubmit: async (e: Event) => {
      e.preventDefault();
      status.textContent = 'Sending…';
      try { await api.sendMagicLink(input.value.trim()); status.textContent = 'Check your inbox for a sign-in link.'; }
      catch (err) { status.textContent = `Could not send link: ${msg(err)}`; }
    },
  }, h('h2', {}, 'Sign in'), h('label', {}, 'Email', input), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Email me a sign-in link'), status);
}

function nav(api: Api, tab: string): HTMLElement {
  const link = (id: string, label: string) => h('a', { href: `#tab=${id}`, class: tab === id ? 'active' : undefined }, label);
  return h('nav', { class: 'admin-nav', 'aria-label': 'Dashboard' },
    link('leads', 'Leads'), link('links', 'Tracked links'), link('overview', 'Overview'),
    h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { void api.signOut(); } }, 'Sign out'));
}

function statusSelect(api: Api, lead: Lead): HTMLSelectElement {
  const sel: HTMLSelectElement = h('select', {
    'aria-label': `Status for ${lead.name}`,
    onchange: async () => {
      const next = sel.value as LeadStatus;
      sel.disabled = true;
      try { await api.updateLead(lead.id, { status: next }); lead.status = next; sel.title = ''; sel.classList.remove('failed'); }
      catch (e) { sel.value = lead.status; sel.title = `Not saved: ${msg(e)}`; sel.classList.add('failed'); }
      finally { sel.disabled = false; }
    },
  }, ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: s === lead.status }, s)));
  return sel;
}

async function leadsView(api: Api, status?: LeadStatus): Promise<HTMLElement> {
  const leads = await api.leads(status);
  const filter = h('select', {
    'aria-label': 'Filter by status',
    onchange: async (e: Event) => {
      const v = (e.target as HTMLSelectElement).value as LeadStatus | '';
      try { view()?.replaceChildren(await leadsView(api, v || undefined)); } catch (err) { view()?.replaceChildren(errorBox(msg(err))); }
    },
  }, h('option', { value: '' }, 'All statuses'), ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: s === status }, s)));

  const head = h('div', { class: 'toolbar' }, h('h2', {}, `Leads (${leads.length})`), filter);
  if (!leads.length) return h('section', {}, head, h('p', { class: 'muted' }, 'No leads yet. Share a tracked link to get started.'));

  const rows = leads.map((l) => h('tr', {},
    h('td', {}, fmt.format(new Date(l.created_at))),
    h('td', {}, h('a', { href: `#lead=${l.id}` }, l.name)),
    h('td', {}, l.business ?? '–'),
    h('td', {}, l.first_ref ?? l.ref ?? '–'),
    h('td', {}, statusSelect(api, l))));
  return h('section', {}, head, h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, ...['Received', 'Name', 'Business', 'Source', 'Status'].map((t) => h('th', {}, t)))),
    h('tbody', {}, ...rows))));
}

async function leadDetail(api: Api, id: string): Promise<HTMLElement> {
  const lead = await api.lead(id);
  if (!lead) return h('section', {}, h('a', { href: '#tab=leads' }, '← All leads'), h('p', {}, 'Lead not found.'));
  const journey = lead.visitor_id ? sortJourney(await api.journey(lead.visitor_id)) : [];

  const pair = (k: string, v: Node | string) => [h('dt', {}, k), h('dd', {}, v)];
  const facts = h('dl', { class: 'facts' },
    ...pair('Email', h('a', { href: `mailto:${lead.email}` }, lead.email)),
    ...pair('Phone', lead.phone ? h('a', { href: `tel:${lead.phone.replace(/[^0-9+]/g, '')}` }, lead.phone) : '–'),
    ...pair('Business', lead.business ?? '–'),
    ...pair('Package', lead.package ?? '–'),
    ...pair('Source link', lead.first_ref ?? lead.ref ?? 'Direct / unknown'),
    ...pair('Received', fmt.format(new Date(lead.created_at))),
    ...pair('Status', statusSelect(api, lead)));

  const notes = h('textarea', { rows: '5', 'aria-label': 'Notes' });
  notes.value = lead.notes ?? '';
  const saved = h('span', { class: 'muted', role: 'status' });
  const save = h('button', {
    class: 'btn btn-ghost', type: 'button',
    onclick: async () => {
      saved.textContent = 'Saving…';
      try { await api.updateLead(lead.id, { notes: notes.value }); saved.textContent = 'Saved'; }
      catch (e) { saved.textContent = `Not saved: ${msg(e)}`; }
    },
  }, 'Save notes');

  const timeline = journey.length
    ? h('ol', { class: 'timeline' }, ...journey.map((e) => h('li', {}, h('time', {}, fmt.format(new Date(e.created_at))), ' ', eventLabel(e))))
    : h('p', { class: 'muted' }, 'No journey recorded. This visitor did not accept analytics, so only the source link (if any) is known.');

  return h('section', { class: 'detail' },
    h('a', { href: '#tab=leads' }, '← All leads'),
    h('h2', {}, lead.name),
    h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, facts, h('h3', {}, 'Message'), h('p', { class: 'pre' }, lead.message), h('h3', {}, 'Notes'), notes, h('div', { class: 'row' }, save, saved)),
      h('div', { class: 'card' }, h('h3', {}, 'Journey'), timeline)));
}

async function linksView(api: Api): Promise<HTMLElement> {
  const stats = await api.linkStats();
  const label = h('input', { name: 'label', required: true, maxlength: '120', placeholder: 'Romford Traders WhatsApp group' });
  const slug = h('input', { name: 'slug', required: true, maxlength: '64', placeholder: 'romford-traders-wa' });
  label.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugFromLabel(label.value) ?? ''; });
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; });
  const channel = h('select', { name: 'channel' }, ...CHANNELS.map((c) => h('option', { value: c }, c)));
  const destination = h('input', { name: 'destination', value: '/', placeholder: '/services/' });
  const status = h('p', { class: 'muted', role: 'status' });

  const form = h('form', {
    class: 'card',
    onsubmit: async (e: Event) => {
      e.preventDefault();
      const s = slugFromLabel(slug.value);
      const dest = destination.value.trim() || '/';
      if (!s) { status.textContent = 'The slug can only use a–z, 0–9, - and _.'; return; }
      if (!dest.startsWith('/')) { status.textContent = 'The destination must be a page on your site, starting with /.'; return; }
      status.textContent = 'Creating…';
      try {
        await api.createLink({ slug: s, label: label.value.trim(), channel: channel.value, destination: dest });
        view()?.replaceChildren(await linksView(api));
      } catch (err) { status.textContent = `Could not create link: ${msg(err)}`; }
    },
  },
    h('h2', {}, 'New tracked link'),
    h('div', { class: 'row' }, h('label', {}, 'Label', label), h('label', {}, 'Slug', slug)),
    h('div', { class: 'row' }, h('label', {}, 'Channel', channel), h('label', {}, 'Lands on', destination)),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create link'),
    status);

  const copyButton = (text: string, labelText: string) => {
    const b = h('button', { class: 'btn btn-ghost', type: 'button' }, labelText);
    b.addEventListener('click', () => {
      if (!navigator.clipboard) { b.textContent = 'Copy not supported'; return; }
      navigator.clipboard.writeText(text).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Copy failed'; });
    });
    return b;
  };

  const cards = stats.map((l) => {
    const u = trackedUrl(site.url, l.destination, l.slug);
    return h('article', { class: 'card link' },
      h('h3', {}, l.label),
      h('p', { class: 'mono' }, u),
      h('p', { class: 'muted' }, `${l.channel} · ${l.landings} visits · ${l.visitors} consented visitors · ${l.leads} leads · ${conversionRate(l.leads, l.landings)} conversion`),
      h('div', { class: 'row' }, copyButton(u, 'Copy link'), copyButton(shareText(u), 'Copy WhatsApp message')));
  });

  return h('section', {}, form, h('h2', {}, `Your links (${stats.length})`), ...(cards.length ? cards : [h('p', { class: 'muted' }, 'No links yet.')]));
}

async function overviewView(api: Api): Promise<HTMLElement> {
  const [o, stats] = await Promise.all([api.overview(30), api.linkStats()]);
  const top = [...stats].sort((a, b) => b.landings - a.landings).slice(0, 5);
  const tile = (n: number, label: string) => h('div', { class: 'card tile' }, h('strong', {}, String(n)), h('span', { class: 'muted' }, label));
  return h('section', {},
    h('h2', {}, 'Last 30 days'),
    h('div', { class: 'grid-3' }, tile(o.landings, 'tracked-link visits'), tile(o.views, 'page views (consented)'), tile(o.leads, 'leads')),
    h('h2', {}, 'Top links'),
    top.length ? h('ol', {}, ...top.map((l) => h('li', {}, `${l.label}: ${l.landings} visits, ${l.leads} leads`))) : h('p', { class: 'muted' }, 'No tracked links yet.'));
}
