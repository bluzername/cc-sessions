import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { HookServer } from '../../src/sessions/hooks.js';

const HOOK_SCRIPT = resolve(import.meta.dirname, '..', '..', 'hooks', 'claude-hook.js');
const PORT = 17950;
const SECRET = 'hook-script-secret';

function runHook(homeDir, input) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [HOOK_SCRIPT], {
      env: { ...process.env, HOME: homeDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

async function waitFor(predicate, timeoutMs = 2000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for hook payload');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('hooks/claude-hook.js', () => {
  let homeDir;
  let server;
  const received = [];

  beforeAll(async () => {
    homeDir = mkdtempSync(join(tmpdir(), 'cc-hook-home-'));
    mkdirSync(join(homeDir, '.cc-sessions'), { recursive: true });
    writeFileSync(join(homeDir, '.cc-sessions', 'secret'), SECRET);
    writeFileSync(join(homeDir, '.cc-sessions', 'config.json'), JSON.stringify({ port: PORT }));
    server = new HookServer({
      port: PORT,
      secret: SECRET,
      onHook: async (payload) => {
        received.push(payload);
      },
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('forwards UserPromptSubmit with a prompt truncated to 200 chars, silently', async () => {
    const before = received.length;
    const result = await runHook(homeDir, {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'sess-1',
      cwd: '/tmp/project-a',
      prompt: 'p'.repeat(500),
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    await waitFor(() => received.length > before);
    const payload = received[received.length - 1];
    expect(payload.event).toBe('user_prompt_submit');
    expect(payload.prompt).toHaveLength(200);
    expect(payload.project).toBe('project-a');
    expect(payload.working_dir).toBe('/tmp/project-a');
    expect(payload.session_id).toBe('sess-1');
  });

  it('forwards SessionStart and SessionEnd with canonical event names', async () => {
    const before = received.length;
    const start = await runHook(homeDir, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: '/tmp/project-b',
    });
    const end = await runHook(homeDir, {
      hook_event_name: 'SessionEnd',
      reason: 'exit',
      cwd: '/tmp/project-b',
    });

    expect(start.code).toBe(0);
    expect(end.code).toBe(0);
    expect(start.stdout + end.stdout).toBe('');
    await waitFor(() => received.length >= before + 2);
    const events = received.slice(before).map((p) => p.event);
    expect(events).toEqual(['session_start', 'session_end']);
    expect(received[before].source).toBe('startup');
    expect(received[before + 1].reason).toBe('exit');
    expect(received[before].prompt).toBeUndefined();
  });

  it('exits 0 with no stdout on malformed input', async () => {
    const result = await runHook(homeDir, 'not json at all');
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 0 quickly when the server is unreachable', async () => {
    const deadHome = mkdtempSync(join(tmpdir(), 'cc-hook-dead-'));
    mkdirSync(join(deadHome, '.cc-sessions'), { recursive: true });
    writeFileSync(join(deadHome, '.cc-sessions', 'config.json'), JSON.stringify({ port: 17999 }));
    const started = Date.now();
    const result = await runHook(deadHome, { hook_event_name: 'Stop', cwd: '/tmp/x' });
    rmSync(deadHome, { recursive: true, force: true });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
