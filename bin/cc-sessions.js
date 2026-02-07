#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { loadOrCreateSecret, CC_SESSIONS_DIR } from '../src/config.js';

const command = process.argv[2];

switch (command) {
  case 'start':
    await startServer();
    break;
  case 'setup':
    await setup();
    break;
  case 'status':
    await showStatus();
    break;
  case 'daemon':
    await daemon(process.argv[3]);
    break;
  default:
    printHelp();
    break;
}

async function startServer() {
  const { start } = await import('../src/index.js');
  await start();
}

async function setup() {
  console.log('Setting up cc-sessions...\n');

  // 1. Create config directory
  mkdirSync(CC_SESSIONS_DIR, { recursive: true });
  console.log(`  [1/4] Config directory: ${CC_SESSIONS_DIR}`);

  // 2. Generate or load shared secret
  const secret = loadOrCreateSecret();
  console.log(`  [2/4] Shared secret: ${secret.slice(0, 8)}...`);

  // 3. Copy hook script
  const hookSrc = resolve(import.meta.dirname, '..', 'hooks', 'claude-hook.js');
  const hookDest = join(CC_SESSIONS_DIR, 'hook.js');
  copyFileSync(hookSrc, hookDest);
  console.log(`  [3/4] Hook installed: ${hookDest}`);

  // 4. Merge hook config into Claude Code settings
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  mergeHookSettings(settingsPath, hookDest);
  console.log(`  [4/4] Claude Code settings updated: ${settingsPath}`);

  console.log('\n\u2713 Hook installed. Start Claude Code sessions and they\'ll appear in Telegram.');
  console.log('\nNext steps:');
  console.log('  1. Set TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_ID in your environment or .env file');
  console.log('  2. Run: cc-sessions start');
}

function mergeHookSettings(settingsPath, hookPath) {
  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      // Corrupt file — start fresh but preserve raw content as backup
      const backup = settingsPath + '.bak';
      copyFileSync(settingsPath, backup);
      console.log(`    (backed up corrupt settings to ${backup})`);
    }
  }

  if (!settings.hooks) settings.hooks = {};

  const hookCommand = `node "${hookPath}"`;

  // Merge Stop hook
  mergeHookEvent(settings.hooks, 'Stop', hookCommand);

  // Merge Notification hook (for idle prompts)
  mergeHookEvent(settings.hooks, 'Notification', hookCommand);

  // Write back
  mkdirSync(join(homedir(), '.claude'), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function mergeHookEvent(hooks, eventName, command) {
  if (!hooks[eventName]) hooks[eventName] = [];

  // Check if our hook is already installed
  const existing = hooks[eventName].find((entry) =>
    entry.hooks?.some((h) => h.command?.includes('cc-sessions') || h.command?.includes('.cc-sessions/hook.js')),
  );

  if (existing) {
    // Update existing
    const hook = existing.hooks.find(
      (h) => h.command?.includes('cc-sessions') || h.command?.includes('.cc-sessions/hook.js'),
    );
    if (hook) hook.command = command;
  } else {
    // Add new
    hooks[eventName].push({
      matcher: '',
      hooks: [
        {
          type: 'command',
          command,
          timeout: 5,
        },
      ],
    });
  }
}

async function showStatus() {
  const port = process.env.HOOK_PORT || 7890;
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`);
    if (resp.ok) {
      console.log('cc-sessions is running.');
      // Try to read session store
      const storePath =
        process.env.SESSION_STORE_PATH || join(CC_SESSIONS_DIR, 'sessions.json');
      if (existsSync(storePath)) {
        const data = JSON.parse(readFileSync(storePath, 'utf-8'));
        const sessions = Object.values(data);
        const active = sessions.filter((s) => s.status !== 'archived');
        console.log(`  Active sessions: ${active.length}`);
        for (const s of active) {
          const emoji =
            s.status === 'active'
              ? '\u{1F7E2}'
              : s.status === 'idle'
                ? '\u{1F7E1}'
                : s.status === 'error'
                  ? '\u{1F534}'
                  : '\u2705';
          console.log(`  ${emoji} ${s.project} \u00B7 ${s.machine}`);
        }
      }
    }
  } catch {
    console.log('cc-sessions is not running.');
    console.log(`  (checked http://127.0.0.1:${port}/health)`);
  }
}

async function daemon(action) {
  const pidFile = join(CC_SESSIONS_DIR, 'daemon.pid');
  const logFile = join(CC_SESSIONS_DIR, 'daemon.log');

  switch (action) {
    case 'start': {
      if (existsSync(pidFile)) {
        const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
        try {
          process.kill(pid, 0); // Check if process exists
          console.log(`Daemon already running (PID ${pid}).`);
          return;
        } catch {
          // PID file is stale
        }
      }

      mkdirSync(CC_SESSIONS_DIR, { recursive: true });
      const entryPath = resolve(import.meta.dirname, '..', 'src', 'index.js');

      const out = (await import('fs')).openSync(logFile, 'a');
      const child = spawn('node', ['-e', `import('${entryPath}').then(m => m.start())`], {
        detached: true,
        stdio: ['ignore', out, out],
        env: { ...process.env },
      });

      writeFileSync(pidFile, String(child.pid));
      child.unref();
      console.log(`Daemon started (PID ${child.pid}).`);
      console.log(`  Logs: ${logFile}`);
      break;
    }
    case 'stop': {
      if (!existsSync(pidFile)) {
        console.log('No daemon running.');
        return;
      }
      const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`Daemon stopped (PID ${pid}).`);
      } catch {
        console.log('Daemon was not running.');
      }
      try {
        (await import('fs')).unlinkSync(pidFile);
      } catch {
        // ignore
      }
      break;
    }
    case 'logs': {
      if (!existsSync(logFile)) {
        console.log('No log file found.');
        return;
      }
      const { execSync } = await import('child_process');
      execSync(`tail -f "${logFile}"`, { stdio: 'inherit' });
      break;
    }
    default:
      console.log('Usage: cc-sessions daemon [start|stop|logs]');
  }
}

function printHelp() {
  console.log(`
cc-sessions - Real-time mobile monitoring for Claude Code sessions via Telegram

Commands:
  cc-sessions start          Start bot + hook server (foreground)
  cc-sessions setup          Install hooks and validate config
  cc-sessions status         Show running sessions
  cc-sessions daemon start   Start as background daemon
  cc-sessions daemon stop    Stop background daemon
  cc-sessions daemon logs    Tail daemon log file

Environment:
  TELEGRAM_BOT_TOKEN         Bot token from @BotFather (required)
  TELEGRAM_GROUP_ID          Supergroup ID with Forum Topics (required)
  HOOK_PORT                  HTTP port for hooks (default: 7890)
  HOOK_SECRET                Shared secret (default: auto-generated)
  AUTO_ARCHIVE_HOURS         Close stale topics after N hours (default: 24)

Docs: https://github.com/user/cc-sessions
`);
}
