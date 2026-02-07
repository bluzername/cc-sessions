/**
 * Smart truncation preserving the END of text (where the prompt is).
 * Telegram max message length is 4096 chars.
 */

const DEFAULT_MAX = 3500; // Reserve space for header/footer/formatting

export function truncate(text, maxLen = DEFAULT_MAX) {
  if (!text) return '';
  if (text.length <= maxLen) return text;

  const tail = text.slice(-maxLen);
  // Find first clean line break
  const firstNewline = tail.indexOf('\n');
  const cleanTail = firstNewline > 0 ? tail.slice(firstNewline + 1) : tail;
  const lines = cleanTail.split('\n').length;
  return `…(showing last ${lines} lines)\n\n${cleanTail}`;
}
