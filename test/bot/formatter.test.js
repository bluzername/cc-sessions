import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  formatStopNotification,
  formatSessionStart,
  formatSessionResumed,
  formatSessionList,
} from '../../src/bot/formatter.js';

describe('escapeHtml', () => {
  it('escapes < > &', () => {
    expect(escapeHtml('<div>&test</div>')).toBe('&lt;div&gt;&amp;test&lt;/div&gt;');
  });

  it('handles empty/null', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('formatStopNotification', () => {
  const session = {
    status: 'idle',
    project: 'vantage',
    machine: 'macbook-pro',
    last_output: 'Do you want to continue? [Y/n]',
    last_activity: new Date().toISOString(),
  };

  it('includes status emoji and label', () => {
    const msg = formatStopNotification(session);
    expect(msg).toContain('Waiting for input');
  });

  it('includes output in pre block', () => {
    const msg = formatStopNotification(session);
    expect(msg).toContain('<pre>');
    expect(msg).toContain('[Y/n]');
  });

  it('includes project and machine', () => {
    const msg = formatStopNotification(session);
    expect(msg).toContain('vantage');
    expect(msg).toContain('macbook-pro');
  });

  it('handles empty output', () => {
    const msg = formatStopNotification({ ...session, last_output: '' });
    expect(msg).not.toContain('<pre>');
  });

  it('escapes HTML in output', () => {
    const msg = formatStopNotification({
      ...session,
      last_output: '<script>alert(1)</script>',
    });
    expect(msg).toContain('&lt;script&gt;');
    expect(msg).not.toContain('<script>');
  });

  it('shows correct emoji for each status', () => {
    expect(formatStopNotification({ ...session, status: 'active' })).toContain('\u{1F7E2}');
    expect(formatStopNotification({ ...session, status: 'error' })).toContain('\u{1F534}');
    expect(formatStopNotification({ ...session, status: 'completed' })).toContain('\u2705');
  });

  it('truncates long output', () => {
    const longOutput = 'x'.repeat(5000);
    const msg = formatStopNotification({ ...session, last_output: longOutput });
    expect(msg.length).toBeLessThan(5000);
  });
});

describe('formatSessionStart', () => {
  it('formats new session message', () => {
    const msg = formatSessionStart({
      project: 'my-app',
      machine: 'dev-box',
      working_dir: '/home/dev/my-app',
    });
    expect(msg).toContain('New session');
    expect(msg).toContain('my-app');
    expect(msg).toContain('dev-box');
    expect(msg).toContain('/home/dev/my-app');
  });
});

describe('formatSessionResumed', () => {
  it('formats resumed message', () => {
    const msg = formatSessionResumed({ project: 'app', machine: 'mac' });
    expect(msg).toContain('Session resumed');
    expect(msg).toContain('app');
  });
});

describe('formatSessionList', () => {
  it('shows empty message for no sessions', () => {
    expect(formatSessionList([])).toBe('No active sessions.');
  });

  it('lists sessions with status emoji', () => {
    const sessions = [
      { project: 'app1', machine: 'mac', status: 'active' },
      { project: 'app2', machine: 'linux', status: 'idle' },
    ];
    const msg = formatSessionList(sessions);
    expect(msg).toContain('app1');
    expect(msg).toContain('app2');
    expect(msg).toContain('\u{1F7E2}');
    expect(msg).toContain('\u{1F7E1}');
  });
});
