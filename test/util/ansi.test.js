import { describe, it, expect } from 'vitest';
import { stripAnsi } from '../../src/util/ansi.js';

describe('stripAnsi', () => {
  it('strips color codes', () => {
    expect(stripAnsi('\x1B[32mgreen\x1B[0m')).toBe('green');
  });

  it('strips cursor movement codes', () => {
    expect(stripAnsi('\x1B[2Jhello\x1B[H')).toBe('hello');
  });

  it('strips mixed ANSI sequences', () => {
    const input = '\x1B[1m\x1B[31mError:\x1B[0m file not found\x1B[K';
    expect(stripAnsi(input)).toBe('Error: file not found');
  });

  it('passes clean text through unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles null/undefined', () => {
    expect(stripAnsi(null)).toBe('');
    expect(stripAnsi(undefined)).toBe('');
  });

  it('collapses multiple blank lines', () => {
    expect(stripAnsi('a\n\n\n\nb')).toBe('a\n\nb');
  });
});
