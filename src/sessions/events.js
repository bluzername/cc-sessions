/**
 * Canonical Claude Code lifecycle events and the pure mappings derived from them.
 * The hook script sends `hook_event_name` in whatever casing Claude Code uses;
 * everything server-side works with the canonical snake_case names below.
 */

export const EVENTS = Object.freeze({
  SESSION_START: 'session_start',
  USER_PROMPT_SUBMIT: 'user_prompt_submit',
  STOP: 'stop',
  NOTIFICATION: 'notification',
  SESSION_END: 'session_end',
});

const EVENT_ALIASES = Object.freeze({
  sessionstart: EVENTS.SESSION_START,
  session_start: EVENTS.SESSION_START,
  userpromptsubmit: EVENTS.USER_PROMPT_SUBMIT,
  user_prompt_submit: EVENTS.USER_PROMPT_SUBMIT,
  stop: EVENTS.STOP,
  notification: EVENTS.NOTIFICATION,
  sessionend: EVENTS.SESSION_END,
  session_end: EVENTS.SESSION_END,
});

const STATUS_BY_EVENT = Object.freeze({
  [EVENTS.SESSION_START]: 'active',
  [EVENTS.USER_PROMPT_SUBMIT]: 'active',
  [EVENTS.SESSION_END]: 'completed',
  [EVENTS.STOP]: 'idle',
  [EVENTS.NOTIFICATION]: 'idle',
});

const DEFAULT_STATUS = 'idle';

/** Longest task label stored on a session and shown in topic names. */
export const TASK_MAX_LENGTH = 80;
const ELLIPSIS = '...';

/**
 * Map a raw hook event name (any casing) to its canonical form.
 * Missing input defaults to `stop`; unknown names pass through lowercased.
 */
export function normalizeEvent(raw) {
  const key = String(raw || EVENTS.STOP).toLowerCase();
  return EVENT_ALIASES[key] || key;
}

/** Session status implied by a canonical event. */
export function statusForEvent(event) {
  return STATUS_BY_EVENT[event] || DEFAULT_STATUS;
}

/**
 * Turn a user prompt into a short single-line task label, or null if empty.
 */
export function deriveTask(prompt) {
  if (!prompt) return null;
  const collapsed = String(prompt).replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  if (collapsed.length <= TASK_MAX_LENGTH) return collapsed;
  return collapsed.slice(0, TASK_MAX_LENGTH - ELLIPSIS.length).trimEnd() + ELLIPSIS;
}
