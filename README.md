# cc-sessions

Real-time mobile monitoring for parallel Claude Code sessions via Telegram.

## Problem

Developers running multiple Claude Code sessions lose track of which ones are waiting for input. Sessions sit idle — sometimes for 30+ minutes — because the developer walked away or switched context. Multiply by 3-10 parallel sessions across multiple machines and you're hemorrhaging productivity.

## How It Works

```
Machine A                         Telegram                        Your Phone
┌─────────────┐                ┌─────────────────┐            ┌──────────────┐
│ session 1 ──hook──→         │  cc-sessions      │            │              │
│ session 2 ──hook──→         │ ├─ 🟡 firmware    │  ──push──→ │  🔔 firmware │
│                             │ ├─ 🟢 ios-app     │            │  is waiting  │
└─────────────┘                │ └─ 🔴 ml-models   │            │              │
Machine B                      └─────────────────┘  ←──reply─ │  [Yes] [No]  │
┌─────────────┐                        ↑                       └──────────────┘
│ session 3 ──hook──→                  │
└─────────────┘                Each session = 1 Forum Topic
```

One session = one Telegram Forum Topic. Topics live in a supergroup. Each has independent notifications, message history, and inline keyboards for quick responses. Reply in a topic to send input to the correct Claude session.

## Quick Start

```bash
# 1. Install
npm install -g cc-sessions

# 2. Create a Telegram bot via @BotFather and a supergroup with Forum Topics enabled
#    Add the bot as admin to the group

# 3. Configure
export TELEGRAM_BOT_TOKEN="your-token"
export TELEGRAM_GROUP_ID="-100xxxxxxxxxx"

# 4. Install Claude Code hooks
cc-sessions setup

# 5. Start
cc-sessions start
```

## Commands

| Command                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| `cc-sessions start`        | Start bot + hook server (foreground)          |
| `cc-sessions setup`        | Install Claude Code hooks and validate config |
| `cc-sessions status`       | Show running sessions                         |
| `cc-sessions daemon start` | Start as background daemon                    |
| `cc-sessions daemon stop`  | Stop daemon                                   |
| `cc-sessions daemon logs`  | Tail daemon log                               |

## Telegram Commands

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `/sessions`    | List all active sessions with status |
| `/archive`     | Archive current topic's session      |
| `/archive_all` | Archive all stale sessions           |
| `/help`        | Usage guide                          |

## Configuration

| Variable             | Required | Default                      | Description                         |
| -------------------- | -------- | ---------------------------- | ----------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Yes      | —                            | Bot token from @BotFather           |
| `TELEGRAM_GROUP_ID`  | Yes      | —                            | Supergroup ID (starts with -100)    |
| `HOOK_PORT`          | No       | 7890                         | HTTP port for hook payloads         |
| `HOOK_SECRET`        | No       | auto-generated               | Shared secret for hook auth         |
| `AUTO_ARCHIVE_HOURS` | No       | 24                           | Close topics after N hours inactive |
| `SESSION_STORE_PATH` | No       | ~/.cc-sessions/sessions.json | Session state file                  |
| `LOG_LEVEL`          | No       | info                         | debug, info, warn, error            |

## Session Status

| Emoji | Status    | Meaning                      |
| ----- | --------- | ---------------------------- |
| 🟢    | Active    | Claude is working            |
| 🟡    | Idle      | Claude waiting for input     |
| 🔴    | Error     | Session errored              |
| ✅    | Completed | Session finished             |
| ⚫    | Archived  | Auto-closed after inactivity |

## Response Injection

When Claude is waiting for input, reply in the topic or tap an inline button. Responses are injected via tmux `send-keys`. If tmux isn't available, you get a copyable command.

## Multi-Machine Setup

See [docs/MULTI_MACHINE.md](docs/MULTI_MACHINE.md) for SSH tunnel and Tailscale configurations.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it works internally.

## Development

```bash
git clone https://github.com/user/cc-sessions
cd cc-sessions
npm install
npm test
npm run lint
```

## License

MIT
