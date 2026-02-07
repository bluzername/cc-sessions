import { describe, it, expect, afterEach } from 'vitest';
import { HookServer } from '../../src/sessions/hooks.js';
import { BASIC_STOP, WRONG_SECRET } from '../fixtures/hook-payloads.js';

describe('HookServer', () => {
  let server;

  afterEach(async () => {
    if (server) await server.stop();
  });

  it('starts and responds to health check', async () => {
    server = new HookServer({ port: 17891, secret: 'test', onHook: async () => {} });
    await server.start();

    const res = await fetch('http://127.0.0.1:17891/health');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('accepts valid hook payload', async () => {
    let received = null;
    server = new HookServer({
      port: 17892,
      secret: 'test-secret-123',
      onHook: async (payload) => {
        received = payload;
      },
    });
    await server.start();

    const res = await fetch('http://127.0.0.1:17892/hook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BASIC_STOP),
    });

    expect(res.ok).toBe(true);
    // Give async handler time to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(received).not.toBeNull();
    expect(received.project).toBe('vantage-firmware');
    // Secret should be stripped
    expect(received.secret).toBeUndefined();
  });

  it('rejects wrong secret', async () => {
    server = new HookServer({
      port: 17893,
      secret: 'test-secret-123',
      onHook: async () => {},
    });
    await server.start();

    const res = await fetch('http://127.0.0.1:17893/hook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(WRONG_SECRET),
    });

    expect(res.status).toBe(401);
  });

  it('rejects malformed JSON', async () => {
    server = new HookServer({
      port: 17894,
      secret: 'test',
      onHook: async () => {},
    });
    await server.start();

    const res = await fetch('http://127.0.0.1:17894/hook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown routes', async () => {
    server = new HookServer({ port: 17895, secret: 'test', onHook: async () => {} });
    await server.start();

    const res = await fetch('http://127.0.0.1:17895/unknown');
    expect(res.status).toBe(404);
  });
});
