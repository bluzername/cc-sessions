import { describe, it, expect } from 'vitest';
import { truncate } from '../../src/util/truncate.js';

describe('truncate', () => {
  it('returns text under limit unchanged', () => {
    expect(truncate('short text', 100)).toBe('short text');
  });

  it('truncates text over limit keeping the end', () => {
    const text = 'line1\nline2\nline3\nline4\nline5';
    const result = truncate(text, 20);
    expect(result).toContain('line5');
    expect(result).toContain('showing last');
  });

  it('finds clean line break', () => {
    const text = 'a'.repeat(50) + '\n' + 'b'.repeat(10);
    const result = truncate(text, 30);
    expect(result).toContain('b'.repeat(10));
    expect(result).not.toContain('a'.repeat(50));
  });

  it('handles empty string', () => {
    expect(truncate('')).toBe('');
    expect(truncate(null)).toBe('');
  });
});
