# cc-sessions

Real-time mobile monitoring for parallel Claude Code sessions via Telegram.

## Problem

Developers running multiple Claude Code sessions lose track of which ones are waiting for input. Sessions sit idle, sometimes for 30+ minutes, because the developer walked away or switched context. Multiply by 3-10 parallel sessions across multiple machines and you're hemorrhaging productivity.

## How It Works

```
Machine A                         Telegram                        Your Phone
┌─────────────┐                ┌─────────────────┐            ┌──────────────┐
│ session 1 ──hook──→         │  cc-sessions      │            │              │
│ session 2 ──hook──→         │ ├─ 🟡 firmware    │  ──push──→ │  🔔 firmware │
│                             │ ├─ 🟢 ios-app     │            │  is waiting  │
└─────────────┘                │ └─ ✅ ml-models   │            │              │
Machine B                      └─────────────────┘  ←──reply─ │  [Yes] [No]  │
┌─────────────┐                        ↑                       └──────────────┘
│ session 3 ──hook──→                  │
└─────────────┘                Each session = 1 Forum Topic
```

One session = one Telegram Forum Topic. Topics live in a supergroup. Each has independent notifications, message history, and inline keyboards for quick responses. Reply in a topic to send input to the correct Claude session.

Claude Code hooks fire on session lifecycle events and POST to a small local HTTP server. The server keeps a session store, creates or reuses a Forum Topic per `machine:working_dir`, renames the topic with the current status and task, and posts a notification with buttons whenever Claude stops and waits for you.

## Requirements

- Node.js 20 or newer
- Claude Code
- A Telegram bot and a supergroup with Forum Topics enabled
- tmux, if you want replies from Telegram injected back into the session (see [Response Injection](#response-injection))

## Quick Start

```bash
# 1. Install from GitHub (the "cc-sessions" name on npm belongs to a different project)
npm install -g github:bluzername/cc-sessions

# 2. Create a Telegram bot via @BotFather and a supergroup with Forum Topics enabled
#    Add the bot as admin to the group

# 3. Configure
export TELEGRAM_BOT_TOKEN="your-token"
export TELEGRAM_GROUP_ID="-100xxxxxxxxxx"

# 4. Install Claude Code hooks into ~/.claude/settings.json
cc-sessions setup

# 5. Start the bot + hook server
cc-sessions start
```

Run `cc-sessions setup` again any time; it is idempotent and never duplicates hooks.

## What Gets Tracked

`cc-sessions setup` installs one hook for each of these Claude Code events:

| Hook event         | Session status | What happens in Telegram                                                |
| ------------------ | -------------- | ----------------------------------------------------------------------- |
| `SessionStart`     | 🟢 Active      | Topic created (or reopened), "New session" or "Session resumed" message |
| `UserPromptSubmit` | 🟢 Active      | Task label updated from your prompt, topic renamed (no message)         |
| `Stop`             | 🟡 Idle        | Notification with Claude's last output and response buttons             |
| `Notification`     | 🟡 Idle        | Same as `Stop` (covers permission and idle prompts)                     |
| `SessionEnd`       | ✅ Completed   | "Session ended" message                                                 |

The hook script (`~/.cc-sessions/hook.js`) is dependency-free, always exits 0, never writes to stdout, and gives up after a few seconds if the server is down, so it can never block or break a Claude Code session.

## Commands

| Command                    | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `cc-sessions start`        | Start bot + hook server (foreground)                   |
| `cc-sessions setup`        | Install the hook script and Claude Code hooks          |
| `cc-sessions status`       | Show running sessions (status, project, machine, task) |
| `cc-sessions daemon start` | Start as background daemon                             |
| `cc-sessions daemon stop`  | Stop daemon                                            |
| `cc-sessions daemon logs`  | Tail daemon log                                        |

## Telegram Commands

| Command        | Description                                   |
| -------------- | --------------------------------------------- |
| `/sessions`    | List all active sessions with status and task |
| `/archive`     | Archive current topic's session               |
| `/archive_all` | Archive all stale sessions                    |
| `/help`        | Usage guide                                   |

## Configuration

Environment variables, or a `.env` file in the directory you start `cc-sessions` from.

| Variable             | Required | Default                        | Description                                       |
| -------------------- | -------- | ------------------------------ | ------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Yes      | none                           | Bot token from @BotFather                         |
| `TELEGRAM_GROUP_ID`  | Yes      | none                           | Supergroup ID (must start with `-100`)            |
| `HOOK_PORT`          | No       | `7890`                         | HTTP port for hook payloads (1024-65535)          |
| `HOOK_SECRET`        | No       | `~/.cc-sessions/secret`        | Shared secret for hook auth (auto-generated file) |
| `AUTO_ARCHIVE_HOURS` | No       | `24`                           | Close topics after N hours inactive               |
| `SESSION_STORE_PATH` | No       | `~/.cc-sessions/sessions.json` | Session state file                                |
| `LOG_LEVEL`          | No       | `info`                         | debug, info, warn, error                          |

The hook server listens on `127.0.0.1` only. The hook script reads an optional `~/.cc-sessions/config.json` (`{ "host": "...", "port": 7890 }`) to target a different server; see [Multi-Machine Setup](docs/MULTI_MACHINE.md).

Files created under `~/.cc-sessions/`: `secret`, `hook.js`, `sessions.json`, and for daemon mode `daemon.pid` and `daemon.log`.

## Session Status

| Emoji | Status    | Meaning                                   |
| ----- | --------- | ----------------------------------------- |
| 🟢    | Active    | Claude is working                         |
| 🟡    | Idle      | Claude waiting for input                  |
| 🔴    | Error     | Session errored                           |
| ✅    | Completed | Session ended                             |
| ⚫    | Archived  | Closed after inactivity or via `/archive` |

## Response Injection

When Claude is waiting for input, reply in the topic or tap an inline button. cc-sessions injects the reply with `tmux send-keys` into the tmux pane whose current path matches the session's working directory, so run Claude Code inside tmux on the machine where `cc-sessions` is running. If tmux is not available or no matching pane is found, the bot replies with a copyable `tmux send-keys` command instead.

Prompt detection picks the buttons: `[Y/n]` and `[y/N]` become Yes/No, numbered lists become number buttons, allow/deny prompts become Allow/Deny, anything else gets Continue/Stop.

## Multi-Machine Setup

See [docs/MULTI_MACHINE.md](docs/MULTI_MACHINE.md) for running sessions on remote machines through an SSH tunnel.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it works internally, and [docs/SETUP.md](docs/SETUP.md) for the step-by-step setup guide.

## Development

```bash
git clone https://github.com/bluzername/cc-sessions
cd cc-sessions
npm ci
npm test
npm run lint
npm run format:check
```

CI runs the same three commands on Node 20, 22 and 24.

## License

MIT
