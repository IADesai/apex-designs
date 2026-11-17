// The portal's chat assistant: a small scripted conversation that turns "can you change X" into a
// complete, actionable request. Pure logic (no DOM, no network), so it is free to run and easy to test.
import type { ChangeKind, ChatLine, Urgency } from '../../supabase/functions/_shared/change.ts';

export type Step = 'what' | 'page' | 'details' | 'urgency' | 'confirm' | 'done';

export interface Draft {
  what: string;
  kind: ChangeKind;
  page: string;
  details: string;
  urgency: Urgency;
}

export interface ChatState {
  step: Step;
  draft: Draft;
  transcript: ChatLine[];
}

export interface Turn {
  state: ChatState;
  say: string;
  chips: string[];
  /** True once the client has confirmed: the caller should now send `toSubmission(state)`. */
  submit: boolean;
}

const KIND_HINTS: [ChangeKind, RegExp][] = [
  ['fix', /\b(broken|bug|error|not working|doesn'?t work|won'?t|can'?t|wrong|typo|mistake|fix|404|slow|crash)/i],
  ['image', /\b(photo|image|picture|logo|gallery|banner|video|pic)s?\b/i],
  ['new', /\b(add|new|create|another|extra)\b.*\b(page|section|form|feature|menu|product|service|post|button|link)/i],
  ['design', /\b(colou?r|font|layout|spacing|design|style|look|bigger|smaller|move|align)/i],
  ['text', /\b(text|wording|word|copy|price|prices|hours|opening|phone|number|address|email|title|heading|paragraph|description|menu|say|says|change|update|replace)/i],
];

export const KIND_LABELS: Record<ChangeKind, string> = {
  text: 'Text or details',
  image: 'Photos or media',
  new: 'Something new',
  fix: 'Something is broken',
  design: 'Look and layout',
  other: 'Something else',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  urgent: 'Urgent',
  normal: 'This week',
  whenever: 'No rush',
};

export function guessKind(text: string): ChangeKind {
  for (const [kind, pattern] of KIND_HINTS) if (pattern.test(text)) return kind;
  return 'other';
}

function parseUrgency(text: string): Urgency {
  if (/no rush|whenever|any ?time|not urgent|no hurry|later/i.test(text)) return 'whenever';
  if (/urgent|asap|today|now|immediately|emergency/i.test(text)) return 'urgent';
  return 'normal';
}

const DETAIL_PROMPTS: Record<ChangeKind, string> = {
  text: 'What should it say instead? Please give the exact new wording, numbers or times.',
  image: 'Which photo or image should change, and what should replace it? If you have the new files, say where we can get them (you can send them on WhatsApp too).',
  new: 'What should the new part include? Headings, text, anything it needs to do.',
  fix: 'What happens at the moment, and what should happen instead? Tell us the device or browser if you know it.',
  design: 'How should it look instead? If there is a site you like the look of, mention it.',
  other: 'Tell us exactly what you would like, with as much detail as you can.',
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

const summarise = (d: Draft): string =>
  [
    'Here is what we have:',
    `• Change: ${d.what}`,
    `• Where: ${d.page}`,
    `• Details: ${d.details}`,
    `• When: ${URGENCY_LABELS[d.urgency]}`,
    'Shall we send this to the team?',
  ].join('\n');

const emptyDraft = (): Draft => ({ what: '', kind: 'other', page: '', details: '', urgency: 'normal' });

export function startChat(clientName: string): Turn {
  const say = `Hi ${firstName(clientName)}. What would you like changed on your website? One change at a time works best.`;
  return { state: { step: 'what', draft: emptyDraft(), transcript: [{ from: 'agent', text: say }] }, say, chips: [], submit: false };
}

export function replyChat(prev: ChatState, input: string): Turn {
  const text = input.trim().slice(0, 1500);
  if (!text) return { state: prev, say: 'Sorry, we did not catch that. Could you type or say it again?', chips: [], submit: false };

  // After a request has been sent, the next message simply starts a new one.
  const from: ChatState = prev.step === 'done' ? { step: 'what', draft: emptyDraft(), transcript: [] } : prev;
  const draft = { ...from.draft };
  let step = from.step;
  let say = '';
  let chips: string[] = [];
  let submit = false;

  switch (from.step) {
    case 'what':
      if (text.length < 4) { say = 'Could you say a little more about what you would like changed?'; break; }
      draft.what = text;
      draft.kind = guessKind(text);
      step = 'page';
      say = 'Got it. Which page or part of the site is that on?';
      chips = ['Home page', 'Contact page', 'Every page', 'Not sure'];
      break;
    case 'page':
      draft.page = text.slice(0, 200);
      step = 'details';
      say = DETAIL_PROMPTS[draft.kind];
      break;
    case 'details':
      if (text.length < 10) { say = 'A little more detail helps us get it right first time. What exactly should change?'; break; }
      draft.details = text;
      step = 'urgency';
      say = 'Thanks. How soon do you need it?';
      chips = Object.values(URGENCY_LABELS);
      break;
    case 'urgency':
      draft.urgency = parseUrgency(text);
      step = 'confirm';
      say = summarise(draft);
      chips = ['Send it', 'Start again'];
      break;
    case 'confirm':
      if (/^(send|yes|yep|yeah|ok|okay|go|correct|confirm|that'?s right|looks good)/i.test(text)) {
        step = 'done';
        submit = true;
        say = 'Sending that to the team now…';
      } else if (/^(start again|restart|no|cancel)\b/i.test(text)) {
        step = 'what';
        Object.assign(draft, emptyDraft());
        say = 'No problem, let us start again. What would you like changed?';
      } else {
        // Anything else is treated as an extra detail, so nothing the client says is lost.
        draft.details = `${draft.details}\n${text}`.slice(0, 4000);
        say = summarise(draft);
        chips = ['Send it', 'Start again'];
      }
      break;
  }

  const transcript: ChatLine[] = [...from.transcript, { from: 'client', text }, { from: 'agent', text: say }];
  return { state: { step, draft, transcript }, say, chips, submit };
}

/** The payload for the client-portal function. Long first answers keep their full text in the details. */
export function toSubmission(state: ChatState) {
  const d = state.draft;
  const long = d.what.length > 110;
  return {
    title: long ? `${d.what.slice(0, 107).trimEnd()}…` : d.what,
    kind: d.kind,
    page: d.page,
    details: long ? `${d.what}\n\n${d.details}` : d.details,
    urgency: d.urgency,
    transcript: state.transcript,
  };
}
