import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleHookPayload } from '../../src/bot/bot.js';
import { SessionStore } from '../../src/sessions/store.js';
import { clearTimers } from '../../src/bot/topics.js';
import {
  BASIC_STOP,
  SESSION_START,
  SESSION_END,
  USER_PROMPT_SUBMIT,
} from '../fixtures/hook-payloads.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const KEY = 'macbook-pro:/Users/evy/vantage-firmware';

function makeBot() {
  let nextTopic = 100;
  return {
    api: {
      createForumTopic: vi.fn(async () => ({ message_thread_id: nextTopic++ })),
      editForumTopic: vi.fn(async () => true),
      reopenForumTopic: vi.fn(async () => true),
      closeForumTopic: vi.fn(async () => true),
      sendMessage: vi.fn(async () => ({ message_id: 1 })),
    },
  };
}

function sentTexts(bot) {
  return bot.api.sendMessage.mock.calls.map((c) => c[1]);
}

describe('handleHookPayload', () => {
  let bot;
  let store;
  let tmpDir;
  const config = { telegramGroupId: -1001234567890, autoArchiveHours: 24 };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-bot-test-'));
    store = new SessionStore(join(tmpDir, 'sessions.json'));
    bot = makeBot();
  });

  afterEach(() => {
    clearTimers();
    store.destroy();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('session_start creates a topic, marks active, posts start message only', async () => {
    await handleHookPayload(bot, config, store, SESSION_START);

    const session = store.get(KEY);
    expect(session.status).toBe('active');
    expect(session.topic_id).toBe(100);
    expect(bot.api.createForumTopic).toHaveBeenCalledTimes(1);
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1);
    expect(sentTexts(bot)[0]).toContain('New session');
    expect(bot.api.sendMessage.mock.calls[0][2].reply_markup).toBeUndefined();
  });

  it('session_start on a known session reopens the topic and posts resumed', async () => {
    await handleHookPayload(bot, config, store, BASIC_STOP);
    bot.api.sendMessage.mockClear();

    await handleHookPayload(bot, config, store, SESSION_START);

    expect(bot.api.createForumTopic).toHaveBeenCalledTimes(1);
    expect(bot.api.reopenForumTopic).toHaveBeenCalledWith(config.telegramGroupId, 100);
    expect(sentTexts(bot)).toHaveLength(1);
    expect(sentTexts(bot)[0]).toContain('Session resumed');
    expect(store.get(KEY).status).toBe('active');
  });

  it('user_prompt_submit sets task, stays active, sends no message on a known session', async () => {
    await handleHookPayload(bot, config, store, SESSION_START);
    bot.api.sendMessage.mockClear();

    await handleHookPayload(bot, config, store, USER_PROMPT_SUBMIT);

    const session = store.get(KEY);
    expect(session.status).toBe('active');
    expect(session.task).toBe('Fix the BLE buffer overflow in the firmware');
    expect(bot.api.sendMessage).not.toHaveBeenCalled();
  });

  it('user_prompt_submit on an unknown session still creates its topic', async () => {
    await handleHookPayload(bot, config, store, USER_PROMPT_SUBMIT);

    expect(bot.api.createForumTopic).toHaveBeenCalledTimes(1);
    expect(store.get(KEY).topic_id).toBe(100);
    expect(sentTexts(bot)[0]).toContain('New session');
  });

  it('stop keeps the task, marks idle and sends a keyboard notification', async () => {
    await handleHookPayload(bot, config, store, USER_PROMPT_SUBMIT);
    bot.api.sendMessage.mockClear();

    await handleHookPayload(bot, config, store, BASIC_STOP);

    const session = store.get(KEY);
    expect(session.status).toBe('idle');
    expect(session.task).toBe('Fix the BLE buffer overflow in the firmware');
    expect(session.prompt_type).toBe('yesno');
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1);
    expect(sentTexts(bot)[0]).toContain('Waiting for input');
    expect(bot.api.sendMessage.mock.calls[0][2].reply_markup).toBeDefined();
  });

  it('session_end marks completed and posts an end message without a keyboard', async () => {
    await handleHookPayload(bot, config, store, SESSION_START);
    bot.api.sendMessage.mockClear();

    await handleHookPayload(bot, config, store, SESSION_END);

    expect(store.get(KEY).status).toBe('completed');
    expect(sentTexts(bot)).toHaveLength(1);
    expect(sentTexts(bot)[0]).toContain('Session ended');
    expect(bot.api.sendMessage.mock.calls[0][2].reply_markup).toBeUndefined();
  });

  it('accepts raw Claude Code event names', async () => {
    await handleHookPayload(bot, config, store, { ...SESSION_START, event: 'SessionStart' });
    expect(store.get(KEY).status).toBe('active');
    expect(store.get(KEY).last_event).toBe('session_start');
  });
});
