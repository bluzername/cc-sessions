import { Bot, GrammyError, HttpError } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { createTopic, updateTopicStatus, reopenTopic, closeTopic } from './topics.js';
import {
  formatStopNotification,
  formatSessionStart,
  formatSessionList,
} from './formatter.js';
import { buildKeyboard } from './keyboards.js';
import { detectPrompt } from '../util/detect-prompt.js';
import { setupRouter } from './router.js';

/**
 * Create and configure the Grammy bot.
 * @param {object} config - Application config
 * @param {import('../sessions/store.js').SessionStore} store
 * @param {import('../sessions/injector.js').Injector} injector
 */
export async function createBot(config, store, injector) {
  const bot = new Bot(config.telegramBotToken);

  // Auto-retry on rate limits
  bot.api.config.use(autoRetry());

  const groupId = config.telegramGroupId;

  // Verify bot has access to group and topics are enabled
  await verifyGroup(bot.api, groupId);

  // Register commands
  await bot.api.setMyCommands([
    { command: 'sessions', description: 'List all active sessions' },
    { command: 'archive', description: 'Archive current topic session' },
    { command: 'archive_all', description: 'Archive all stale sessions' },
    { command: 'help', description: 'Usage guide' },
  ]);

  // Command handlers
  bot.command('sessions', async (ctx) => {
    const sessions = store.getActive();
    const text = formatSessionList(sessions);
    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  bot.command('archive', async (ctx) => {
    const topicId = ctx.message?.message_thread_id;
    if (!topicId) {
      await ctx.reply('Use this command inside a session topic.');
      return;
    }
    const session = store.getByTopicId(topicId);
    if (!session) {
      await ctx.reply('No session linked to this topic.');
      return;
    }
    store.update(session.key, { status: 'archived' });
    await closeTopic(bot.api, groupId, topicId);
    await ctx.reply('\u26AB Session archived.');
  });

  bot.command('archive_all', async (ctx) => {
    const stale = store.getStale(config.autoArchiveHours);
    let count = 0;
    for (const session of stale) {
      store.update(session.key, { status: 'archived' });
      if (session.topic_id) {
        try {
          await closeTopic(bot.api, groupId, session.topic_id);
          count++;
        } catch {
          // Topic may already be closed
        }
      }
    }
    await ctx.reply(`Archived ${count} stale session(s).`);
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        '<b>cc-sessions</b> \u2014 Claude Code session monitor',
        '',
        '/sessions \u2014 List active sessions',
        '/archive \u2014 Archive this topic\'s session',
        '/archive_all \u2014 Archive all stale sessions',
        '/help \u2014 This message',
        '',
        'Reply in any session topic to send input to Claude.',
        'Use inline buttons for quick responses.',
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  // Setup message router (handles text messages + callback queries)
  setupRouter(bot, store, injector, groupId);

  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error(`Grammy error in ${ctx?.update?.update_id}:`, e.message);
    } else if (e instanceof HttpError) {
      console.error('HTTP error:', e.message);
    } else {
      console.error('Bot error:', e);
    }
  });

  return bot;
}

/**
 * Handle an incoming hook payload: upsert session, manage topic, send notification.
 */
export async function handleHookPayload(bot, config, store, payload) {
  const groupId = config.telegramGroupId;

  // Upsert session
  const session = store.upsert(payload);
  const promptInfo = detectPrompt(session.last_output);
  store.update(session.key, { prompt_type: promptInfo.type });

  // Create or reuse topic
  if (!session.topic_id) {
    // New session — create topic
    const topicId = await createTopic(bot.api, groupId, session);
    store.update(session.key, { topic_id: topicId });
    session.topic_id = topicId;

    // Post start message
    await bot.api.sendMessage(groupId, formatSessionStart(session), {
      message_thread_id: topicId,
      parse_mode: 'HTML',
    });
  } else {
    // Existing session — try to reopen if closed
    try {
      await reopenTopic(bot.api, groupId, session.topic_id);
    } catch {
      // May already be open
    }
  }

  // Update topic name
  updateTopicStatus(bot.api, groupId, session.topic_id, session);

  // Send notification with inline keyboard
  const keyboard = buildKeyboard(promptInfo, session.hash);
  await bot.api.sendMessage(groupId, formatStopNotification(session), {
    message_thread_id: session.topic_id,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Verify bot is admin in group and topics are enabled.
 */
async function verifyGroup(api, groupId) {
  try {
    const chat = await api.getChat(groupId);
    if (!chat.is_forum) {
      throw new Error(
        `Group ${groupId} does not have Forum Topics enabled. ` +
          'Enable them in group settings → Topics.',
      );
    }
  } catch (err) {
    if (err instanceof GrammyError) {
      throw new Error(
        `Cannot access group ${groupId}. Make sure the bot is added as admin. ` +
          `Telegram error: ${err.message}`,
      );
    }
    throw err;
  }
}

/**
 * Auto-archive stale sessions. Call periodically.
 */
export async function archiveStaleSessions(bot, config, store) {
  const stale = store.getStale(config.autoArchiveHours);
  for (const session of stale) {
    store.update(session.key, { status: 'archived' });
    if (session.topic_id) {
      try {
        await closeTopic(bot.api, config.telegramGroupId, session.topic_id);
      } catch {
        // Ignore
      }
    }
  }
}
