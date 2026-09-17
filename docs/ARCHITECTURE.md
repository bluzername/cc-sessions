# Architecture

## Overview

cc-sessions has three main components:

1. **Claude Code Hook** — A lightweight script that fires on Claude Code lifecycle events
2. **Hook Server** — An HTTP server that receives hook payloads and manages sessions
3. **Telegram Bot** — A Grammy bot that creates Forum Topics and handles user interaction

## Data Flow

```
Claude Code Session
        │
        ├─ Stop event fires
        │
        ▼
  Hook Script (hooks/claude-hook.js)
        │
        ├─ Reads stdin for hook input JSON
        ├─ Reads transcript file for last output
        ├─ POSTs payload to hook server
        │
        ▼
  Hook Server (src/sessions/hooks.js)
        │
        ├─ Validates shared secret
        ├─ Upserts session in store
        │
        ▼
  Bot Handler (src/bot/bot.js)
        │
        ├─ Creates/reuses Forum Topic
        ├─ Detects prompt type
        ├─ Formats notification message
        ├─ Attaches inline keyboard
        ├─ Sends to Telegram
        │
        ▼
  User's Phone (Telegram)
        │
        ├─ User taps button or types reply
        │
        ▼
  Message Router (src/bot/router.js)
        │
        ├─ Maps topic → session
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

The store is in-memory with debounced JSON file persistence (every 5 seconds). On startup, it loads from disk.

## Prompt Detection

When Claude stops, the hook captures the last assistant output. The prompt detector (`src/util/detect-prompt.js`) analyzes the last 500 chars to determine what kind of response Claude expects:

- **Y/n questions** → Yes/No buttons
- **Numbered choices** → Number buttons
- **Tool approval** → Allow/Deny buttons
- **Freeform** → Continue/Stop buttons

## Topic Lifecycle

1. **New session** → Create Forum Topic with status emoji
2. **Status change** → Rename topic (debounced, max 1 per 30s)
3. **Session inactive** → Close topic after configurable hours
4. **Session resumes** → Reopen topic, post "resumed" message

## Security

- Hook payloads are authenticated via a shared secret
- The hook server listens on 127.0.0.1 by default (localhost only)
- The shared secret is stored in `~/.cc-sessions/secret` with 0600 permissions
