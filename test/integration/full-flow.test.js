import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../../src/sessions/store.js';
import { HookServer } from '../../src/sessions/hooks.js';
import { detectPrompt } from '../../src/util/detect-prompt.js';
import { buildKeyboard, parseCallbackData } from '../../src/bot/keyboards.js';
import { formatStopNotification, formatSessionStart } from '../../src/bot/formatter.js';
import { buildTopicName } from '../../src/bot/topics.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let nextPort = 18900;

describe('Full flow integration', () => {
  let store;
  let hookServer;
  let tmpDir;
  let hookPayloads;
  let port;

  beforeEach(async () => {
    port = nextPort++;
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-int-test-'));
    store = new SessionStore(join(tmpDir, 'sessions.json'));
    hookPayloads = [];

    hookServer = new HookServer({
      port,
      secret: 'integration-test',
      onHook: async (payload) => {
        hookPayloads.push(payload);
        // Simulate what handleHookPayload does
        const session = store.upsert(payload);
        const promptInfo = detectPrompt(session.last_output);
        store.update(session.key, { prompt_type: promptInfo.type });
      },
    });
    await hookServer.start();
  });

  afterEach(async () => {
    store.destroy();
    await hookServer.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hook payload creates session and detects prompt', async () => {
    // Step 1: Send hook payload
    const res = await fetch(`http://127.0.0.1:${port}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'stop',
        session_id: 'sess1',
        machine: 'macbook-pro',
        project: 'vantage-firmware',
        working_dir: '/Users/evy/vantage-firmware',
        timestamp: '2026-02-07T11:15:00Z',
        output: 'Do you want me to fix the BLE buffer overflow? [Y/n]',
        secret: 'integration-test',
      }),
    });
    expect(res.ok).toBe(true);

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 100));

    // Step 2: Verify session was created
    const session = store.get('macbook-pro:/Users/evy/vantage-firmware');
    expect(session).not.toBeNull();
    expect(session.project).toBe('vantage-firmware');
    expect(session.status).toBe('idle');
    expect(session.prompt_type).toBe('yesno');

    // Step 3: Verify notification can be formatted
    store.update(session.key, { topic_id: 42 });
    const notification = formatStopNotification(session);
    expect(notification).toContain('Waiting for input');
    expect(notification).toContain('[Y/n]');

    // Step 4: Verify keyboard was built correctly
    const promptInfo = detectPrompt(session.last_output);
    const keyboard = buildKeyboard(promptInfo, session.hash);
    expect(keyboard).toBeDefined();
    const rows = keyboard.inline_keyboard;
    expect(rows[0][0].text).toContain('Yes');

    // Step 5: Verify callback parsing works end-to-end
    const callbackData = rows[0][0].callback_data;
    const parsed = parseCallbackData(callbackData);
    expect(parsed.hash).toBe(session.hash);
    expect(parsed.value).toBe('y');
    expect(store.getByHash(parsed.hash)).toBe(session);
  });

  it('second session on different machine creates separate entry', async () => {
    // First session
    await fetch(`http://127.0.0.1:${port}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'stop',
        machine: 'macbook-pro',
        project: 'app',
        working_dir: '/Users/evy/app',
        output: 'Done.',
        secret: 'integration-test',
      }),
    });

    // Second session on different machine
    await fetch(`http://127.0.0.1:${port}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'stop',
        machine: 'build-server',
        project: 'app',
        working_dir: '/var/builds/app',
        output: 'Deploy? [Y/n]',
        secret: 'integration-test',
      }),
    });

    await new Promise((r) => setTimeout(r, 100));

    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.machine).sort()).toEqual(['build-server', 'macbook-pro']);
  });

  it('same machine+project upserts (no duplicate)', async () => {
    const payload = {
      event: 'stop',
      machine: 'mac',
      project: 'proj',
      working_dir: '/proj',
      output: 'first output',
      secret: 'integration-test',
    };

    await fetch(`http://127.0.0.1:${port}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await fetch(`http://127.0.0.1:${port}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, output: 'second output' }),
    });

    await new Promise((r) => setTimeout(r, 100));

    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].last_output).toBe('second output');
  });

  it('session topic name reflects status', () => {
    const session = store.upsert({
      machine: 'mac',
      project: 'firmware',
      working_dir: '/fw',
      event: 'stop',
    });

    const idleName = buildTopicName(session);
    expect(idleName).toContain('\u{1F7E1}');
    expect(idleName).toContain('firmware');

    store.update(session.key, { status: 'active' });
    const activeName = buildTopicName(store.get(session.key));
    expect(activeName).toContain('\u{1F7E2}');
  });

  it('stale session detection works', async () => {
    const session = store.upsert({
      machine: 'mac',
      project: 'old',
      working_dir: '/old',
      event: 'stop',
    });
    store.update(session.key, {
      last_activity: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    });

    const stale = store.getStale(24);
    expect(stale).toHaveLength(1);
    expect(stale[0].project).toBe('old');

    // Archive it
    store.update(session.key, { status: 'archived' });
    const staleAfter = store.getStale(24);
    expect(staleAfter).toHaveLength(0);
  });

  it('new session start format is correct', () => {
    const session = store.upsert({
      machine: 'mac',
      project: 'new-project',
      working_dir: '/new-project',
      event: 'stop',
    });
    const msg = formatSessionStart(session);
    expect(msg).toContain('New session');
    expect(msg).toContain('new-project');
    expect(msg).toContain('/new-project');
  });
});
