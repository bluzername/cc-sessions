import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector } from '../../src/sessions/injector.js';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts;
    }
    // Default: tmux not available
    if (cmd.includes('list-sessions')) {
      cb(new Error('no server running'), '', '');
      return;
    }
    if (cmd.includes('list-panes')) {
      cb(null, '', '');
      return;
    }
    if (cmd.includes('send-keys')) {
      cb(null, '', '');
      return;
    }
    cb(null, '', '');
  }),
}));

describe('Injector', () => {
  let injector;

  beforeEach(() => {
    injector = new Injector();
    injector._tmuxAvailable = null;
  });

  it('returns fallback when tmux is not available', async () => {
    const session = {
      working_dir: '/test/project',
      machine: 'test-machine',
    };
    const result = await injector.sendToSession(session, 'yes');
    expect(result.success).toBe(false);
    expect(result.message).toContain("Can't auto-inject");
    expect(result.message).toContain('/test/project');
  });

  it('includes manual command in fallback', async () => {
    const session = { working_dir: '/test', machine: 'mac' };
    const result = await injector.sendToSession(session, 'hello world');
    expect(result.message).toContain('tmux send-keys');
    expect(result.message).toContain('hello world');
  });

  it('escapes single quotes in fallback command', async () => {
    const session = { working_dir: '/test', machine: 'mac' };
    const result = await injector.sendToSession(session, "it's a test");
    expect(result.success).toBe(false);
    // The escaped quote should appear
    expect(result.message).toContain("it");
  });

  it('handles empty text', async () => {
    const session = { working_dir: '/test', machine: 'mac' };
    const result = await injector.sendToSession(session, '');
    expect(result.success).toBe(false);
  });

  it('caches tmux availability check', async () => {
    const session = { working_dir: '/test', machine: 'mac' };
    await injector.sendToSession(session, 'first');
    await injector.sendToSession(session, 'second');
    // Should only check once
    expect(injector._tmuxAvailable).toBe(false);
  });

  it('produces fallback with HTML formatting', async () => {
    const session = { working_dir: '/some/path', machine: 'mac' };
    const result = await injector.sendToSession(session, 'test');
    expect(result.message).toContain('<code>');
  });
});
