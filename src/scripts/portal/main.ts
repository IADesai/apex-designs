import { h } from '../admin/dom';
import { startChat, replyChat, toSubmission, type ChatState, type Turn } from '../../lib/change-chat';
import { cleanToken, type ChangeStatus } from '../../../supabase/functions/_shared/change.ts';

interface PortalRequest { id: string; title: string; status: ChangeStatus; reply: string | null; created_at: string }
interface PortalData { client: { name: string; business: string; site_url: string | null }; requests: PortalRequest[] }

// What a client sees for each internal status.
const STATUS_LABELS: Record<ChangeStatus, string> = {
  new: 'Received',
  approved: 'Approved',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Not going ahead',
};

const root = document.getElementById('portal');
const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const show = (...nodes: Node[]) => root?.replaceChildren(...nodes);

const base = import.meta.env.PUBLIC_SUPABASE_URL;
const endpoint = base ? `${base.replace(/\/+$/, '')}/functions/v1/client-portal` : undefined;
// The key lives in the URL fragment, which browsers never send to the web host.
const token = cleanToken(new URLSearchParams(window.location.hash.slice(1)).get('key'));

async function call<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!endpoint) return { ok: false, error: 'The portal is not switched on yet.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, token }), signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; errors?: Record<string, string> };
    if (res.ok) return { ok: true, data };
    return { ok: false, error: data.error ?? Object.values(data.errors ?? {})[0] ?? 'Something went wrong.' };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please check your connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}

function contactFallback(message: string): HTMLElement {
  return h('div', { class: 'card' },
    h('h2', {}, 'We could not open your portal'),
    h('p', {}, message),
    h('p', { class: 'muted' }, 'Please use the link we sent you, or get in touch and we will sort it out.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn-ghost', href: `mailto:${root?.dataset.email ?? ''}` }, 'Email us'),
      h('a', { class: 'btn btn-ghost', href: root?.dataset.wa ?? '#', target: '_blank', rel: 'noopener' }, 'WhatsApp us')));
}

function requestList(requests: PortalRequest[]): HTMLElement {
  if (!requests.length) return h('p', { class: 'muted' }, 'Nothing yet. Requests you send will appear here with their progress.');
  return h('ul', { class: 'req-list' }, ...requests.map((r) => h('li', {},
    h('span', { class: 'pill', 'data-status': r.status }, STATUS_LABELS[r.status] ?? r.status), ' ',
    h('time', { datetime: r.created_at }, fmt.format(new Date(r.created_at))),
    h('div', {}, r.title),
    r.reply ? h('p', { class: 'req-reply' }, r.reply) : null)));
}

// Browser speech: free, built in, and optional. Chrome and Safari send the audio to their own
// speech service to transcribe it, which the note under the chat tells the client.
interface HeardResult { readonly isFinal: boolean; readonly [index: number]: { transcript: string } }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<HeardResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
const speechWindow = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const RecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;

const MIC_ICON = 'M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.6a6 6 0 0 0 5-5.9Z';

function micIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', MIC_ICON);
  svg.append(path);
  return svg;
}

function portalView(data: PortalData): HTMLElement {
  let requests = data.requests;
  let state: ChatState;
  let busy = false;

  const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  const chips = h('div', { class: 'chips' });
  const input = h('textarea', { rows: '1', 'aria-label': 'Your message', placeholder: 'Type your message…', maxlength: '1500' });
  const send = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Send');
  const mic = h('button', { class: 'mic', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Speak your message', title: 'Speak your message' }, micIcon());
  const aloud = h('input', { type: 'checkbox' });
  const list = h('div', {}, requestList(requests));

  const bubble = (from: 'agent' | 'client', text: string) => {
    log.append(h('div', { class: `bubble ${from}` }, text));
    log.scrollTop = log.scrollHeight;
  };

  // Voice conversation: the assistant reads its reply, then listens for the answer.
  let recognition: Recognition | null = null;
  let listening = false;
  const setListening = (on: boolean) => { listening = on; mic.setAttribute('aria-pressed', String(on)); };
  const stopListening = () => { recognition?.stop(); };
  const listen = () => {
    if (!RecognitionCtor || listening || busy) return;
    const rec = new RecognitionCtor();
    recognition = rec;
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let heard = '';
      for (let i = 0; i < e.results.length; i++) {
        heard += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = heard;
      }
      input.value = heard;
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => {
      setListening(false);
      // In voice chat a finished sentence is sent straight away, so it flows like a call.
      if (aloud.checked && finalText.trim()) void submitText(finalText);
    };
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };
  const speak = (text: string, thenListen: boolean) => {
    if (!canSpeak || !aloud.checked) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/•/g, ''));
    u.lang = 'en-GB';
    if (thenListen) u.onend = () => { if (aloud.checked) listen(); };
    window.speechSynthesis.speak(u);
  };

  const agentTurn = (turn: Turn) => {
    state = turn.state;
    bubble('agent', turn.say);
    chips.replaceChildren(...turn.chips.map((c) => h('button', { class: 'chip', type: 'button', onclick: () => { void submitText(c); } }, c)));
    speak(turn.say, !turn.submit);
  };

  async function submitText(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text || busy) return;
    stopListening();
    input.value = '';
    bubble('client', text);
    const turn = replyChat(state, text);
    agentTurn(turn);
    if (!turn.submit) return;

    busy = true;
    send.disabled = true;
    const out = await call<{ request: PortalRequest }>({ action: 'submit', ...toSubmission(turn.state) });
    busy = false;
    send.disabled = false;
    if (out.ok) {
      requests = [out.data.request, ...requests];
      list.replaceChildren(requestList(requests));
      const done = 'Sent. We will review it, and you can follow its progress on this page. Anything else you would like changed?';
      bubble('agent', done);
      speak(done, true);
    } else {
      // Step back to the confirmation so the client can try again without retyping anything.
      state = { ...turn.state, step: 'confirm' };
      bubble('agent', `Sorry, that did not send: ${out.error}`);
      chips.replaceChildren(h('button', { class: 'chip', type: 'button', onclick: () => { void submitText('Send it'); } }, 'Try again'));
    }
  }

  const form = h('form', { class: 'composer', onsubmit: (e: Event) => { e.preventDefault(); void submitText(input.value); } }, input, RecognitionCtor ? mic : null, send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitText(input.value); }
  });
  mic.addEventListener('click', () => { if (listening) stopListening(); else listen(); });
  aloud.addEventListener('change', () => {
    if (aloud.checked) return;
    if (canSpeak) window.speechSynthesis.cancel();
    stopListening();
  });

  const voiceNote = RecognitionCtor
    ? h('label', { class: 'voice-toggle' }, aloud, "Voice chat: read replies aloud and listen for my answer. Your browser's speech service turns what you say into text.")
    : canSpeak ? h('label', { class: 'voice-toggle' }, aloud, 'Read replies aloud') : null;

  const view = h('div', {},
    h('p', { class: 'lead' }, `${data.client.business}: tell us what you would like changed and we will take it from there.`),
    h('div', { class: 'portal-grid' },
      h('section', { class: 'card chat', 'aria-label': 'Request a change' }, log, chips, form, voiceNote),
      h('section', { class: 'card' }, h('h2', {}, 'Your requests'), list)));

  agentTurn(startChat(data.client.name));
  return view;
}

async function boot(): Promise<void> {
  if (!token) { show(contactFallback('This link is missing its key.')); return; }
  const out = await call<PortalData>({ action: 'open' });
  if (!out.ok) { show(contactFallback(out.error)); return; }
  show(portalView(out.data));
}

void boot();
