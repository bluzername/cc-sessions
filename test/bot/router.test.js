import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupRouter } from '../../src/bot/router.js';

describe('setupRouter', () => {
  let bot;
  let store;
  let injector;
  let handlers;
  const groupId = -1001234567890;

  beforeEach(() => {
    handlers = {};
    bot = {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
    };
    store = {
      getByTopicId: vi.fn(),
      getByHash: vi.fn(),
    };
    injector = {
      sendToSession: vi.fn(() => ({ success: true })),
    };

    setupRouter(bot, store, injector, groupId);
  });

  it('registers message and callback handlers', () => {
    expect(bot.on).toHaveBeenCalledWith('message:text', expect.any(Function));
    expect(bot.on).toHaveBeenCalledWith('callback_query:data', expect.any(Function));
  });

  it('shows help for messages without topic', async () => {
    const ctx = {
      chat: { id: groupId },
      message: { text: 'hello' },
      reply: vi.fn(),
    };
    await handlers['message:text'](ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      'Send messages in a session topic to interact with Claude Code.',
    );
  });

  it('replies with error for unknown topic', async () => {
    store.getByTopicId.mockReturnValue(null);
    const ctx = {
      chat: { id: groupId },
      message: { text: 'hello', message_thread_id: 42 },
      reply: vi.fn(),
    };
    await handlers['message:text'](ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      'This topic is not linked to an active session.',
      expect.any(Object),
    );
  });

  it('routes message to session via injector', async () => {
    const session = { key: 'mac:/project', working_dir: '/project' };
    store.getByTopicId.mockReturnValue(session);
    const ctx = {
      chat: { id: groupId },
      message: { text: 'yes', message_thread_id: 42 },
      reply: vi.fn(),
      react: vi.fn(),
    };
    await handlers['message:text'](ctx);
    expect(injector.sendToSession).toHaveBeenCalledWith(session, 'yes');
    expect(ctx.react).toHaveBeenCalled();
  });

  it('ignores messages from other groups', async () => {
    const ctx = {
      chat: { id: -100999 },
      message: { text: 'hello', message_thread_id: 42 },
      reply: vi.fn(),
    };
    await handlers['message:text'](ctx);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(injector.sendToSession).not.toHaveBeenCalled();
  });

  it('ignores slash commands (handled by bot command handlers)', async () => {
    const session = { key: 'mac:/project' };
    store.getByTopicId.mockReturnValue(session);
    const ctx = {
      chat: { id: groupId },
      message: { text: '/help', message_thread_id: 42 },
      reply: vi.fn(),
    };
    await handlers['message:text'](ctx);
    expect(injector.sendToSession).not.toHaveBeenCalled();
  });

  it('routes callback queries by hash', async () => {
    const session = { key: 'mac:/p', hash: 'abcd1234' };
    store.getByHash.mockReturnValue(session);

    const ctx = {
      callbackQuery: { data: 'abcd1234:y' },
      answerCallbackQuery: vi.fn(),
    };
    await handlers['callback_query:data'](ctx);
    expect(injector.sendToSession).toHaveBeenCalledWith(session, 'y');
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Sent!' });
  });

  it('returns error for unknown callback hash', async () => {
    store.getByHash.mockReturnValue(null);
    const ctx = {
      callbackQuery: { data: 'unknown1:y' },
      answerCallbackQuery: vi.fn(),
    };
    await handlers['callback_query:data'](ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Session not found' });
  });
});
