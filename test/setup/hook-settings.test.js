import { describe, it, expect } from 'vitest';
import {
  HOOK_EVENTS,
  mergeHookEvent,
  mergeHookSettings,
  isCcSessionsHook,
} from '../../src/setup/hook-settings.js';

const HOOK_PATH = '/Users/evy/.cc-sessions/hook.js';
const COMMAND = `node "${HOOK_PATH}"`;

function countOurHooks(entries) {
  return entries.flatMap((e) => e.hooks || []).filter(isCcSessionsHook).length;
}

describe('HOOK_EVENTS', () => {
  it('covers the full session lifecycle', () => {
    expect(HOOK_EVENTS).toEqual([
      'SessionStart',
      'UserPromptSubmit',
      'Stop',
      'Notification',
      'SessionEnd',
    ]);
  });
});

describe('mergeHookEvent', () => {
  it('adds a hook entry to an empty event list', () => {
    const hooks = mergeHookEvent({}, 'Stop', COMMAND);
    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.Stop[0].hooks[0]).toEqual({ type: 'command', command: COMMAND, timeout: 5 });
  });

  it('does not mutate its input', () => {
    const input = { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo hi' }] }] };
    const snapshot = JSON.stringify(input);
    mergeHookEvent(input, 'Stop', COMMAND);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('preserves unrelated hooks on the same event', () => {
    const input = { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo hi' }] }] };
    const hooks = mergeHookEvent(input, 'Stop', COMMAND);
    expect(hooks.Stop).toHaveLength(2);
    expect(hooks.Stop[0].hooks[0].command).toBe('echo hi');
    expect(countOurHooks(hooks.Stop)).toBe(1);
  });

  it('replaces a legacy cc-sessions hook with the new command', () => {
    const input = {
      Stop: [
        { matcher: '', hooks: [{ type: 'command', command: 'node /old/.cc-sessions/hook.js' }] },
      ],
    };
    const hooks = mergeHookEvent(input, 'Stop', COMMAND);
    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.Stop[0].hooks[0].command).toBe(COMMAND);
  });

  it('collapses duplicate cc-sessions entries into one', () => {
    const dup = { matcher: '', hooks: [{ type: 'command', command: COMMAND, timeout: 5 }] };
    const hooks = mergeHookEvent({ Stop: [dup, dup, dup] }, 'Stop', COMMAND);
    expect(hooks.Stop).toHaveLength(1);
  });

  it('strips our hook out of a mixed entry without dropping the other hooks', () => {
    const input = {
      Stop: [
        {
          matcher: '',
          hooks: [
            { type: 'command', command: 'echo hi' },
            { type: 'command', command: COMMAND },
          ],
        },
      ],
    };
    const hooks = mergeHookEvent(input, 'Stop', COMMAND);
    expect(hooks.Stop).toHaveLength(2);
    expect(hooks.Stop[0].hooks).toEqual([{ type: 'command', command: 'echo hi' }]);
    expect(countOurHooks(hooks.Stop)).toBe(1);
  });
});

describe('mergeHookSettings', () => {
  it('installs one hook per lifecycle event into empty settings', () => {
    const settings = mergeHookSettings({}, HOOK_PATH);
    for (const event of HOOK_EVENTS) {
      expect(settings.hooks[event]).toHaveLength(1);
      expect(settings.hooks[event][0].hooks[0].command).toBe(COMMAND);
    }
  });

  it('is idempotent: running setup twice produces identical settings', () => {
    const once = mergeHookSettings({ someOtherKey: true }, HOOK_PATH);
    const twice = mergeHookSettings(once, HOOK_PATH);
    expect(twice).toEqual(once);
    for (const event of HOOK_EVENTS) {
      expect(countOurHooks(twice.hooks[event])).toBe(1);
    }
  });

  it('preserves other top-level settings and unrelated hooks', () => {
    const input = {
      model: 'opus',
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'lint' }] }],
        Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'say done' }] }],
      },
    };
    const settings = mergeHookSettings(input, HOOK_PATH);
    expect(settings.model).toBe('opus');
    expect(settings.hooks.PreToolUse).toEqual(input.hooks.PreToolUse);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe('say done');
    expect(settings.hooks.Stop).toHaveLength(2);
  });

  it('does not mutate the input settings', () => {
    const input = { hooks: { Stop: [] } };
    const snapshot = JSON.stringify(input);
    mergeHookSettings(input, HOOK_PATH);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
