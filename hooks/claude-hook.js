#!/usr/bin/env node

/**
 * Claude Code Hook Script
 *
 * This is a standalone script that fires on Claude Code lifecycle events
 * and POSTs to the local cc-sessions HTTP server.
 *
 * Installed into ~/.claude/settings.json by `cc-sessions setup`.
 *
 * REQUIREMENTS:
 * - Complete in <5 seconds (Claude Code kills hooks after timeout)
 * - Not crash if cc-sessions server is down (fire-and-forget)
 * - Self-contained (no imports beyond Node.js built-ins)
 * - Works on macOS and Linux
 */

import { readFileSync, existsSync } from 'fs';
import { hostname } from 'os';
import { basename, join } from 'path';
import { request } from 'http';
import { homedir } from 'os';

const CC_DIR = join(homedir(), '.cc-sessions');

async function main() {
  // Read hook input from stdin (Claude Code sends JSON)
  const input = await readStdin(3000);
  let hookInput = {};
  try {
    hookInput = JSON.parse(input);
  } catch {
    // If stdin is not valid JSON, continue with defaults
  }

  // Determine event from hook_event_name or CLI arg
  const event = hookInput.hook_event_name?.toLowerCase() || process.argv[2] || 'stop';

  // For Stop hooks, check stop_hook_active to prevent loops
  if (event === 'stop' && hookInput.stop_hook_active) {
    process.exit(0);
  }

  // Extract session info
  const cwd = hookInput.cwd || process.cwd();
  const sessionId = hookInput.session_id || null;

  // Read last assistant output from transcript if available
  let output = '';
  if (hookInput.transcript_path) {
    output = extractLastOutput(hookInput.transcript_path);
  }

  // Load config
  const config = loadConfig();

  // Load shared secret
  let secret = '';
  const secretPath = join(CC_DIR, 'secret');
  if (existsSync(secretPath)) {
    secret = readFileSync(secretPath, 'utf-8').trim();
  }

  // Build payload
  const payload = {
    event,
    session_id: sessionId,
    machine: hostname(),
    project: basename(cwd),
    working_dir: cwd,
    timestamp: new Date().toISOString(),
    output: output.slice(-3000), // Truncate to 3000 chars
    secret,
  };

  // POST to cc-sessions server (fire-and-forget with timeout)
  const host = config.host || '127.0.0.1';
  const port = config.port || 7890;

  try {
    await postPayload(host, port, payload, 4000);
  } catch {
    // Server may be down — that's OK, fire-and-forget
  }
}

/**
 * Read stdin with a timeout to avoid hanging.
 */
function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    const chunks = [];
    const timer = setTimeout(() => {
      process.stdin.destroy();
      resolve(chunks.join(''));
    }, timeoutMs);

    if (process.stdin.isTTY) {
      clearTimeout(timer);
      resolve('');
      return;
    }

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(chunks.join(''));
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(chunks.join(''));
    });
  });
}

/**
 * Extract the last assistant message from a transcript JSONL file.
 */
function extractLastOutput(transcriptPath) {
  try {
    if (!existsSync(transcriptPath)) return '';
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    // Walk backwards to find the last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.role === 'assistant' && entry.content) {
          // Content may be a string or array of content blocks
          if (typeof entry.content === 'string') {
            return entry.content;
          }
          if (Array.isArray(entry.content)) {
            return entry.content
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('\n');
          }
        }
      } catch {
        continue;
      }
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Load cc-sessions config from ~/.cc-sessions/config.json
 */
function loadConfig() {
  const configPath = join(CC_DIR, 'config.json');
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Use defaults
  }
  return {};
}

/**
 * POST JSON payload to the cc-sessions server.
 */
function postPayload(host, port, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);

    const req = request(
      {
        hostname: host,
        port,
        path: '/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        clearTimeout(timer);
        res.resume();
        resolve();
      },
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

main().catch(() => process.exit(0));
