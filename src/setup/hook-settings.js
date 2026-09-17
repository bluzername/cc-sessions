/**
 * Pure helpers for merging the cc-sessions hook into ~/.claude/settings.json.
 * Every function returns a new object; inputs are never mutated.
 */

/** Claude Code hook events cc-sessions subscribes to, in lifecycle order. */
export const HOOK_EVENTS = Object.freeze([
  'SessionStart',
  'UserPromptSubmit',
  'Stop',
  'Notification',
  'SessionEnd',
]);

const HOOK_TIMEOUT_SECONDS = 5;
const OUR_COMMAND_MARKERS = ['cc-sessions', '.cc-sessions/hook.js'];

/** True when a hook entry's command points at cc-sessions (current or legacy path). */
export function isCcSessionsHook(hook) {
  const command = hook?.command;
  if (typeof command !== 'string') return false;
  return OUR_COMMAND_MARKERS.some((marker) => command.includes(marker));
}

function buildHookEntry(command) {
  return {
    matcher: '',
    hooks: [{ type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS }],
  };
}

/** Drop our hooks from an entry; returns null when nothing else is left. */
function withoutOurHooks(entry) {
  const remaining = (entry.hooks || []).filter((hook) => !isCcSessionsHook(hook));
  if (remaining.length === 0) return null;
  return { ...entry, hooks: remaining };
}

/**
 * Merge exactly one cc-sessions hook into `hooks[eventName]`.
 * Existing cc-sessions hooks (including duplicates and legacy paths) are
 * replaced by a single canonical entry; unrelated hooks are preserved.
 */
export function mergeHookEvent(hooks, eventName, command) {
  const entries = hooks[eventName] || [];
  const others = entries.map(withoutOurHooks).filter((entry) => entry !== null);
  return { ...hooks, [eventName]: [...others, buildHookEntry(command)] };
}

/**
 * Merge the cc-sessions hook for every lifecycle event into a settings object.
 * Idempotent: applying it twice yields the same result as applying it once.
 */
export function mergeHookSettings(settings, hookPath) {
  const command = `node "${hookPath}"`;
  const hooks = HOOK_EVENTS.reduce(
    (acc, eventName) => mergeHookEvent(acc, eventName, command),
    settings.hooks || {},
  );
  return { ...settings, hooks };
}
