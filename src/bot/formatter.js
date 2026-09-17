import { truncate } from '../util/truncate.js';
import { stripAnsi } from '../util/ansi.js';

const STATUS_EMOJI = {
  active: '\u{1F7E2}', // green circle
  idle: '\u{1F7E1}', // yellow circle
  error: '\u{1F534}', // red circle
  completed: '\u2705', // check mark
  archived: '\u26AB', // black circle
};

const STATUS_LABEL = {
  active: 'Working',
  idle: 'Waiting for input',
  error: 'Error',
  completed: 'Completed',
  archived: 'Archived',
};

/**
 * Escape HTML special chars for Telegram HTML mode.
 */
export function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Format a notification message for when Claude stops (waiting for input).
 */
export function formatStopNotification(session) {
  const emoji = STATUS_EMOJI[session.status] || '\u{1F7E1}';
  const label = STATUS_LABEL[session.status] || 'Unknown';

  let output = '';
  if (session.last_output) {
    const clean = stripAnsi(session.last_output);
    const truncated = truncate(clean, 3000);
    output = `\n<pre>${escapeHtml(truncated)}</pre>`;
  }

  const elapsed = formatElapsed(session.last_activity);

  return [
    `${emoji} <b>${escapeHtml(label)}</b>`,
    output,
    `\n\u{1F4C1} ${escapeHtml(session.project)} \u00B7 \u{1F4BB} ${escapeHtml(session.machine)}${elapsed ? ` \u00B7 \u23F1 ${elapsed}` : ''}`,
  ].join('\n');
}

/**
 * Format a "new session started" message.
 */
export function formatSessionStart(session) {
  return [
    `\u{1F680} <b>New session</b>`,
    `\u{1F4C1} <code>${escapeHtml(session.project)}</code>`,
    `\u{1F4BB} ${escapeHtml(session.machine)}`,
    `\u{1F4C2} <code>${escapeHtml(session.working_dir)}</code>`,
  ].join('\n');
}

/**
 * Format a "session resumed" message.
 */
export function formatSessionResumed(session) {
  return `\u25B6\uFE0F <b>Session resumed</b>\n\u{1F4C1} <code>${escapeHtml(session.project)}</code> \u00B7 \u{1F4BB} ${escapeHtml(session.machine)}`;
}

/**
 * Format a "session ended" message (SessionEnd hook).
 */
export function formatSessionEnd(session, reason) {
  const header = `\u{1F3C1} <b>Session ended</b>`;
  const where = `\u{1F4C1} <code>${escapeHtml(session.project)}</code> \u00B7 \u{1F4BB} ${escapeHtml(session.machine)}`;
  const lines = reason ? [header, `reason: ${escapeHtml(reason)}`, where] : [header, where];
  return lines.join('\n');
}

/**
 * Format elapsed time from an ISO timestamp.
 */
function formatElapsed(isoTimestamp) {
  if (!isoTimestamp) return '';
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  if (diffMs < 0) return '';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format the /sessions command output.
 */
export function formatSessionList(sessions) {
  if (sessions.length === 0) {
    return 'No active sessions.';
  }

  return sessions
    .map((s) => {
      const emoji = STATUS_EMOJI[s.status] || '\u2753';
      const head = `${emoji} <b>${escapeHtml(s.project)}</b> \u00B7 ${escapeHtml(s.machine)}`;
      return s.task ? `${head}\n    \u21B3 ${escapeHtml(s.task)}` : head;
    })
    .join('\n');
}
