import { parseCallbackData } from './keyboards.js';

/**
 * Route incoming Telegram messages to the correct Claude Code session.
 * Messages in Forum Topics have a message_thread_id → session mapping.
 */
export function setupRouter(bot, store, injector, groupId) {
  // Handle text messages in topics
  bot.on('message:text', async (ctx) => {
    // Only handle messages in our configured group
    if (ctx.chat.id !== groupId) return;

    const topicId = ctx.message.message_thread_id;

    // General topic or no topic — show help
    if (!topicId) {
      await ctx.reply('Send messages in a session topic to interact with Claude Code.');
      return;
    }

    const session = store.getByTopicId(topicId);
    if (!session) {
      await ctx.reply('This topic is not linked to an active session.', {
        message_thread_id: topicId,
      });
      return;
    }

    const text = ctx.message.text;

    // Ignore bot commands (handled by command handlers)
    if (text.startsWith('/')) return;

    const result = await injector.sendToSession(session, text);
    if (result.success) {
      try {
        await ctx.react('\u{1F44D}');
      } catch {
        // React may fail if bot lacks reaction permissions
      }
    } else {
      await ctx.reply(result.message, {
        message_thread_id: topicId,
        parse_mode: 'HTML',
      });
    }
  });

  // Handle inline keyboard callbacks
  bot.on('callback_query:data', async (ctx) => {
    const parsed = parseCallbackData(ctx.callbackQuery.data);
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: 'Invalid action' });
      return;
    }

    const session = store.getByHash(parsed.hash);
    if (!session) {
      await ctx.answerCallbackQuery({ text: 'Session not found' });
      return;
    }

    // Map button values to actual text to send
    const valueMap = {
      y: 'y',
      n: 'n',
      allow: 'allow',
      deny: 'deny',
      continue: '',
      stop: '/stop',
    };

    const text = valueMap[parsed.value] ?? parsed.value;
    const result = await injector.sendToSession(session, text);

    if (result.success) {
      await ctx.answerCallbackQuery({ text: 'Sent!' });
    } else {
      await ctx.answerCallbackQuery({ text: 'Could not inject response' });
    }
  });
}
