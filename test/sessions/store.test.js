import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../../src/sessions/store.js';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('SessionStore', () => {
  let store;
  let tmpDir;
  let storePath;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-sessions-test-'));
    storePath = join(tmpDir, 'sessions.json');
    store = new SessionStore(storePath);
  });

  afterEach(() => {
    store.destroy();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('upserts a new session', () => {
    const session = store.upsert({
      machine: 'macbook-pro',
      project: 'vantage',
      working_dir: '/Users/evy/vantage',
      event: 'stop',
      output: 'test output',
    });

    expect(session.key).toBe('macbook-pro:/Users/evy/vantage');
    expect(session.status).toBe('idle');
    expect(session.last_output).toBe('test output');
    expect(session.hash).toHaveLength(8);
  });

  it('upserts an existing session (preserves topic_id)', () => {
    const first = store.upsert({
      machine: 'macbook-pro',
      project: 'vantage',
      working_dir: '/Users/evy/vantage',
      event: 'stop',
    });
    store.update(first.key, { topic_id: 42 });

    const second = store.upsert({
      machine: 'macbook-pro',
      project: 'vantage',
      working_dir: '/Users/evy/vantage',
      event: 'stop',
      output: 'new output',
    });

    expect(second.topic_id).toBe(42);
    expect(second.last_output).toBe('new output');
  });

  it('looks up by topic ID', () => {
    const session = store.upsert({
      machine: 'mac',
      project: 'p',
      working_dir: '/p',
      event: 'stop',
    });
    store.update(session.key, { topic_id: 99 });
    const found = store.getByTopicId(99);
    expect(found).not.toBeNull();
    expect(found.project).toBe('p');
  });

  it('returns null for unknown topic ID', () => {
    expect(store.getByTopicId(9999)).toBeNull();
  });

  it('gets active sessions (excludes archived)', () => {
    store.upsert({ machine: 'a', project: 'p1', working_dir: '/p1', event: 'stop' });
    const s2 = store.upsert({ machine: 'a', project: 'p2', working_dir: '/p2', event: 'stop' });
    store.update(s2.key, { status: 'archived' });

    const active = store.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].project).toBe('p1');
  });

  it('gets stale sessions', () => {
    const s = store.upsert({
      machine: 'a',
      project: 'old',
      working_dir: '/old',
      event: 'stop',
      timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    });
    store.update(s.key, {
      last_activity: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    });

    const stale = store.getStale(24);
    expect(stale).toHaveLength(1);
  });

  it('persists and reloads from disk', () => {
    store.upsert({
      machine: 'mac',
      project: 'persist',
      working_dir: '/persist',
      event: 'stop',
    });
    store.saveSync();

    const store2 = new SessionStore(storePath);
    const session = store2.get('mac:/persist');
    expect(session).not.toBeNull();
    expect(session.project).toBe('persist');
    store2.destroy();
  });

  it('removes a session', () => {
    const s = store.upsert({
      machine: 'mac',
      project: 'remove-me',
      working_dir: '/rm',
      event: 'stop',
    });
    store.remove(s.key);
    expect(store.get(s.key)).toBeNull();
  });

  it('looks up by hash', () => {
    const session = store.upsert({
      machine: 'mac',
      project: 'hash-test',
      working_dir: '/hash',
      event: 'stop',
    });
    const found = store.getByHash(session.hash);
    expect(found).not.toBeNull();
    expect(found.project).toBe('hash-test');
  });
});

describe('SessionStore lifecycle events', () => {
  let store;
  let tmpDir;
  const base = { machine: 'mac', project: 'fw', working_dir: '/fw' };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-sessions-events-'));
    store = new SessionStore(join(tmpDir, 'sessions.json'));
  });

  afterEach(() => {
    store.destroy();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('session_start marks the session active', () => {
    const s = store.upsert({ ...base, event: 'session_start' });
    expect(s.status).toBe('active');
    expect(s.task).toBeNull();
  });

  it('user_prompt_submit records a task label', () => {
    const s = store.upsert({ ...base, event: 'user_prompt_submit', prompt: 'Refactor store' });
    expect(s.status).toBe('active');
    expect(s.task).toBe('Refactor store');
  });

  it('stop preserves the task from the last prompt', () => {
    store.upsert({ ...base, event: 'user_prompt_submit', prompt: 'Refactor store' });
    const s = store.upsert({ ...base, event: 'stop', output: 'Done?' });
    expect(s.status).toBe('idle');
    expect(s.task).toBe('Refactor store');
  });

  it('session_end marks the session completed', () => {
    const s = store.upsert({ ...base, event: 'session_end' });
    expect(s.status).toBe('completed');
  });

  it('normalizes raw hook event names', () => {
    const s = store.upsert({ ...base, event: 'SessionStart' });
    expect(s.last_event).toBe('session_start');
    expect(s.status).toBe('active');
  });
});
