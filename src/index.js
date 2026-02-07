import 'dotenv/config';
import { loadConfig } from './config.js';
import { SessionStore } from './sessions/store.js';
import { HookServer } from './sessions/hooks.js';
import { Injector } from './sessions/injector.js';
import { createBot, handleHookPayload, archiveStaleSessions } from './bot/bot.js';

/**
 * Start the cc-sessions server: bot + hook HTTP server.
 */
export async function start() {
  const config = loadConfig();
  const store = new SessionStore(config.sessionStorePath);
  const injector = new Injector();

  // Create and verify bot
  const bot = await createBot(config, store, injector);

  // Start hook HTTP server
  const hookServer = new HookServer({
    port: config.hookPort,
    secret: config.hookSecret,
    onHook: (payload) => handleHookPayload(bot, config, store, payload),
  });
  await hookServer.start();

  // Start bot (long polling)
  bot.start({
    onStart: (botInfo) => {
      console.log(`cc-sessions running.`);
      console.log(`  Bot: @${botInfo.username}`);
      console.log(`  Hook server: http://127.0.0.1:${config.hookPort}`);
      console.log(`  Sessions: ${store.getActive().length} active`);
    },
  });

  // Auto-archive timer (check every hour)
  const archiveInterval = setInterval(
    () => {
      archiveStaleSessions(bot, config, store).catch((err) => {
        console.error('Archive error:', err.message);
      });
    },
    60 * 60 * 1000,
  );

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    clearInterval(archiveInterval);
    bot.stop();
    await hookServer.stop();
    store.saveSync();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { bot, hookServer, store, config };
}
