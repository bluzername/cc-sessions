# Architecture

## Overview

cc-sessions has three main components:

1. **Claude Code Hook** - A dependency-free script that fires on Claude Code lifecycle events
2. **Hook Server** - An HTTP server that receives hook payloads and manages sessions
3. **Telegram Bot** - A grammy bot that creates Forum Topics and handles user interaction

## Lifecycle Events

The hook is installed for five Claude Code events. `src/sessions/events.js` normalizes the event name and maps it to a session status:

| Claude Code event  | Canonical name       | Status    | Telegram side effect                       |
| ------------------ | -------------------- | --------- | ------------------------------------------ |
| `SessionStart`     | `session_start`      | active    | Create topic, or reopen and post "resumed" |
| `UserPromptSubmit` | `user_prompt_submit` | active    | Store task label, rename topic             |
| `Stop`             | `stop`               | idle      | Notification with last output and keyboard |
| `Notification`     | `notification`       | idle      | Same as Stop                               |
| `SessionEnd`       | `session_end`        | completed | "Session ended" message                    |

The task label is derived from the submitted prompt (whitespace collapsed, capped at 80 characters) and shown in the topic name, `/sessions` and `cc-sessions status`.

## Data Flow

```
Claude Code Session
        │
        ├─ SessionStart / UserPromptSubmit / Stop / Notification / SessionEnd
        │
        ▼
  Hook Script (hooks/claude-hook.js, copied to ~/.cc-sessions/hook.js)
        │
        ├─ Reads hook input JSON from stdin
        ├─ Reads transcript file for last output (Stop, Notification, SessionEnd)
        ├─ Adds prompt (UserPromptSubmit), source (SessionStart), reason (SessionEnd)
        ├─ POSTs payload to hook server, always exits 0, never prints
        │
        ▼
  Hook Server (src/sessions/hooks.js)
        │
        ├─ Validates shared secret
        ├─ Hands payload to the bot handler
        │
        ▼
  Bot Handler (src/bot/bot.js)
        │
        ├─ Upserts session in store (status + task from the event)
        ├─ Creates or reopens the Forum Topic
        ├─ Renames the topic (debounced)
        ├─ Per event: start/resumed/ended message, or
        │  prompt detection + notification + inline keyboard
        │
        ▼
  User's Phone (Telegram)
        │
        ├─ User taps button or types reply
        │
        ▼
  Message Router (src/bot/router.js)
        │
        ├─ Maps topic to session
        ├─ Passes to injector
        │
        ▼
  Injector (src/sessions/injector.js)
        │
        ├─ Finds tmux pane by working_dir
        ├─ tmux send-keys
        │
        ▼
  Claude Code Session (receives input)
```

## Session Store

Sessions are keyed by `machine:working_dir` (composite key). This means:

- Same project on different machines = different sessions
- Same machine, different projects = different sessions
- Resuming Claude Code in the same directory = same session (topic reused)

The store is in-memory with debounced JSON file persistence (5 seconds after the last change). On startup, it loads from disk. Each session records status, task, last output, last event, last activity, topic id and a short hash used in inline keyboard callback data.

## Prompt Detection

When Claude stops, the hook captures the last assistant output. The prompt detector (`src/util/detect-prompt.js`) analyzes the last 500 chars to determine what kind of response Claude expects:

- **Y/n questions** become Yes/No buttons
- **Numbered choices** become number buttons
- **Tool approval** becomes Allow/Deny buttons
- **Freeform** becomes Continue/Stop buttons

## Topic Lifecycle

1. **Session starts** (or first event seen) - create a Forum Topic with the status emoji
2. **Status or task change** - rename topic (debounced, max 1 per 30s)
3. **Session ends** - status becomes completed; the topic stays open for history
4. **Session inactive** - close topic after `AUTO_ARCHIVE_HOURS` (checked hourly) or via `/archive`
5. **Session resumes** - reopen topic, post "Session resumed"

## Hook Installation

`cc-sessions setup` merges hook entries into `~/.claude/settings.json` through `src/setup/hook-settings.js`. The merge is pure and idempotent: any existing cc-sessions entries (including duplicates from older versions) are replaced by exactly one entry per event, and unrelated hooks are preserved.

## Security

- Hook payloads are authenticated via a shared secret
- The hook server listens on 127.0.0.1 only
- The shared secret is stored in `~/.cc-sessions/secret` with 0600 permissions
- The hook script never writes to stdout, so nothing it does can be injected into a Claude Code conversation
