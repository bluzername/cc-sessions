import { describe, it, expect } from 'vitest';
import { buildKeyboard, parseCallbackData } from '../../src/bot/keyboards.js';

describe('buildKeyboard', () => {
  const hash = 'abcd1234';

  it('builds yesno keyboard (default y)', () => {
    const kb = buildKeyboard({ type: 'yesno', default: 'y' }, hash);
    expect(kb).toBeDefined();
    // InlineKeyboard stores rows internally
    const rows = kb.inline_keyboard;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
    expect(rows[0][0].text).toContain('Yes');
    expect(rows[0][0].callback_data).toBe('abcd1234:y');
  });

  it('builds yesno keyboard (default n)', () => {
    const kb = buildKeyboard({ type: 'yesno', default: 'n' }, hash);
    const rows = kb.inline_keyboard;
    // Default "no" should come first
    expect(rows[0][0].text).toContain('No');
    expect(rows[0][0].callback_data).toBe('abcd1234:n');
  });

  it('builds choice keyboard', () => {
    const kb = buildKeyboard({ type: 'choice', options: ['1.', '2.', '3.'] }, hash);
    const rows = kb.inline_keyboard;
    expect(rows[0]).toHaveLength(3);
  });

  it('builds approval keyboard', () => {
    const kb = buildKeyboard({ type: 'approval' }, hash);
    const rows = kb.inline_keyboard;
    expect(rows[0][0].text).toContain('Allow');
  });

  it('builds freeform keyboard', () => {
    const kb = buildKeyboard({ type: 'freeform' }, hash);
    const rows = kb.inline_keyboard;
    expect(rows[0][0].text).toContain('Continue');
  });

  it('returns undefined for type "none"', () => {
    expect(buildKeyboard({ type: 'none' }, hash)).toBeUndefined();
  });

  it('callback_data fits in 64 bytes', () => {
    const kb = buildKeyboard({ type: 'freeform' }, hash);
    for (const row of kb.inline_keyboard) {
      for (const btn of row) {
        expect(Buffer.byteLength(btn.callback_data)).toBeLessThanOrEqual(64);
      }
    }
  });
});

describe('parseCallbackData', () => {
  it('parses hash:value format', () => {
    const result = parseCallbackData('abcd1234:y');
    expect(result.hash).toBe('abcd1234');
    expect(result.value).toBe('y');
  });

  it('handles value with colons', () => {
    const result = parseCallbackData('abcd1234:some:complex:value');
    expect(result.hash).toBe('abcd1234');
    expect(result.value).toBe('some:complex:value');
  });

  it('returns null for invalid format', () => {
    expect(parseCallbackData('nocolon')).toBeNull();
  });
});
