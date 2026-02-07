/**
 * Strip ANSI escape codes from terminal output.
 */

// Matches all ANSI escape sequences
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// Collapse multiple blank lines to one
const MULTI_BLANK_RE = /\n{3,}/g;

export function stripAnsi(text) {
  if (!text) return '';
  return text
    .replace(ANSI_RE, '')
    .replace(MULTI_BLANK_RE, '\n\n')
    .trimEnd();
}
