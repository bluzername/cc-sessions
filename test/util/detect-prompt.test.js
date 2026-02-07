import { describe, it, expect } from 'vitest';
import { detectPrompt } from '../../src/util/detect-prompt.js';
import * as outputs from '../fixtures/claude-outputs.js';

describe('detectPrompt', () => {
  it('detects [Y/n] pattern (default yes)', () => {
    const result = detectPrompt(outputs.YES_NO_DEFAULT_YES);
    expect(result.type).toBe('yesno');
    expect(result.default).toBe('y');
  });

  it('detects [y/N] pattern (default no)', () => {
    const result = detectPrompt(outputs.YES_NO_DEFAULT_NO);
    expect(result.type).toBe('yesno');
    expect(result.default).toBe('n');
  });

  it('detects "proceed?" pattern', () => {
    const result = detectPrompt(outputs.PROCEED_QUESTION);
    expect(result.type).toBe('yesno');
    expect(result.default).toBe('y');
  });

  it('detects "continue?" pattern', () => {
    const result = detectPrompt(outputs.CONTINUE_QUESTION);
    expect(result.type).toBe('yesno');
    expect(result.default).toBe('y');
  });

  it('detects numbered choices', () => {
    const result = detectPrompt(outputs.NUMBERED_CHOICES);
    expect(result.type).toBe('choice');
    expect(result.options).toHaveLength(3);
  });

  it('detects tool approval pattern', () => {
    const result = detectPrompt(outputs.TOOL_APPROVAL);
    expect(result.type).toBe('approval');
  });

  it('detects freeform question', () => {
    const result = detectPrompt(outputs.FREEFORM_QUESTION);
    expect(result.type).toBe('freeform');
  });

  it('returns freeform for completed task (no obvious prompt)', () => {
    const result = detectPrompt(outputs.COMPLETED_TASK);
    expect(result.type).toBe('freeform');
  });

  it('detects [Y/n] in long output with code', () => {
    const result = detectPrompt(outputs.LONG_OUTPUT_WITH_CODE);
    expect(result.type).toBe('yesno');
    expect(result.default).toBe('y');
  });

  it('detects [Y/n] in error output', () => {
    const result = detectPrompt(outputs.ERROR_OUTPUT);
    expect(result.type).toBe('yesno');
  });

  it('returns none for empty output', () => {
    const result = detectPrompt(outputs.EMPTY_OUTPUT);
    expect(result.type).toBe('none');
  });

  it('detects "yes or no" phrasing', () => {
    const result = detectPrompt(outputs.YES_OR_NO);
    expect(result.type).toBe('yesno');
  });

  it('detects allow/deny pattern', () => {
    const result = detectPrompt(outputs.ALLOW_DENY);
    expect(result.type).toBe('approval');
  });

  it('handles null input', () => {
    expect(detectPrompt(null).type).toBe('none');
    expect(detectPrompt(undefined).type).toBe('none');
  });

  it('handles ANSI in output', () => {
    // detect-prompt works on raw text; ANSI stripping is done before
    const result = detectPrompt(outputs.ANSI_OUTPUT);
    expect(result.type).toBe('yesno');
  });
});
