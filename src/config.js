import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, hostname } from 'os';
import { randomBytes } from 'crypto';

const CC_SESSIONS_DIR = join(homedir(), '.cc-sessions');

/**
 * Load and validate configuration from environment variables.
 * Fails fast with clear messages if required vars are missing.
 */
export function loadConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupId = process.env.TELEGRAM_GROUP_ID;

  const errors = [];
  if (!token) errors.push('TELEGRAM_BOT_TOKEN is required');
  if (!groupId) errors.push('TELEGRAM_GROUP_ID is required');
  if (groupId && !groupId.startsWith('-100')) {
    errors.push('TELEGRAM_GROUP_ID must start with -100 (supergroup format)');
  }

  const hookPort = parseInt(process.env.HOOK_PORT || '7890', 10);
  if (isNaN(hookPort) || hookPort < 1024 || hookPort > 65535) {
    errors.push('HOOK_PORT must be between 1024 and 65535');
  }

  const autoArchiveHours = parseFloat(process.env.AUTO_ARCHIVE_HOURS || '24');
  if (isNaN(autoArchiveHours) || autoArchiveHours <= 0) {
    errors.push('AUTO_ARCHIVE_HOURS must be greater than 0');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n  - ${errors.join('\n  - ')}`);
  }

  const hookSecret = process.env.HOOK_SECRET || loadOrCreateSecret();
  const sessionStorePath = process.env.SESSION_STORE_PATH || join(CC_SESSIONS_DIR, 'sessions.json');
  const logLevel = process.env.LOG_LEVEL || 'info';

  return {
    telegramBotToken: token,
    telegramGroupId: parseInt(groupId, 10),
    hookPort,
    hookSecret,
    autoArchiveHours,
    sessionStorePath,
    logLevel,
    machineName: hostname(),
    ccSessionsDir: CC_SESSIONS_DIR,
  };
}

/**
 * Load existing shared secret or create one on first run.
 */
export function loadOrCreateSecret() {
  const secretPath = join(CC_SESSIONS_DIR, 'secret');
  if (existsSync(secretPath)) {
    return readFileSync(secretPath, 'utf-8').trim();
  }
  mkdirSync(CC_SESSIONS_DIR, { recursive: true });
  const secret = randomBytes(32).toString('hex');
  writeFileSync(secretPath, secret, { mode: 0o600 });
  return secret;
}

export { CC_SESSIONS_DIR };
