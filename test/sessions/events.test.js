import { describe, it, expect } from 'vitest';
import {
  EVENTS,
  normalizeEvent,
  statusForEvent,
  deriveTask,
  TASK_MAX_LENGTH,
} from '../../src/sessions/events.js';

describe('normalizeEvent', () => {
  it('maps Claude Code hook_event_name values to canonical events', () => {
    expect(normalizeEvent('SessionStart')).toBe(EVENTS.SESSION_START);
    expect(normalizeEvent('SessionEnd')).toBe(EVENTS.SESSION_END);
    expect(normalizeEvent('UserPromptSubmit')).toBe(EVENTS.USER_PROMPT_SUBMIT);
    expect(normalizeEvent('Stop')).toBe(EVENTS.STOP);
    expect(normalizeEvent('Notification')).toBe(EVENTS.NOTIFICATION);
  });

  it('accepts already-canonical and lowercased forms', () => {
    expect(normalizeEvent('session_start')).toBe(EVENTS.SESSION_START);
    expect(normalizeEvent('sessionstart')).toBe(EVENTS.SESSION_START);
    expect(normalizeEvent('userpromptsubmit')).toBe(EVENTS.USER_PROMPT_SUBMIT);
  });

  it('defaults to stop when missing', () => {
    expect(normalizeEvent(undefined)).toBe(EVENTS.STOP);
    expect(normalizeEvent('')).toBe(EVENTS.STOP);
  });

  it('passes unknown events through lowercased', () => {
    expect(normalizeEvent('PreToolUse')).toBe('pretooluse');
  });
});

describe('statusForEvent', () => {
  it('maps session_start and user_prompt_submit to active', () => {
    expect(statusForEvent(EVENTS.SESSION_START)).toBe('active');
    expect(statusForEvent(EVENTS.USER_PROMPT_SUBMIT)).toBe('active');
  });

  it('maps session_end to completed', () => {
    expect(statusForEvent(EVENTS.SESSION_END)).toBe('completed');
  });

  it('maps stop, notification and unknown events to idle', () => {
    expect(statusForEvent(EVENTS.STOP)).toBe('idle');
    expect(statusForEvent(EVENTS.NOTIFICATION)).toBe('idle');
    expect(statusForEvent('pretooluse')).toBe('idle');
  });
});

describe('deriveTask', () => {
  it('returns null for empty input', () => {
    expect(deriveTask('')).toBeNull();
    expect(deriveTask(null)).toBeNull();
    expect(deriveTask(undefined)).toBeNull();
    expect(deriveTask('   \n  ')).toBeNull();
  });

  it('collapses whitespace and newlines into a single line', () => {
    expect(deriveTask('  Fix the\n\n  BLE   bug\t now ')).toBe('Fix the BLE bug now');
  });

  it('truncates long prompts with an ellipsis', () => {
    const task = deriveTask('x'.repeat(500));
    expect(task.length).toBeLessThanOrEqual(TASK_MAX_LENGTH);
    expect(task.endsWith('...')).toBe(true);
  });

  it('keeps short prompts intact', () => {
    expect(deriveTask('Run the tests')).toBe('Run the tests');
  });
});
