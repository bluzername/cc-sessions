# Setup Guide

## Prerequisites

- Node.js >= 20
- A Telegram account
- Claude Code installed
- tmux (optional, needed for injecting replies back into sessions)

## Step 1: Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## Step 2: Create a Telegram Supergroup

1. Create a new group in Telegram
2. Go to group settings, then "Topics", and enable it
3. Add your bot to the group
4. Make the bot an admin (required for creating/managing topics)
5. Get the group ID:
   - Send a message in the group
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find the `chat.id` (starts with `-100`)

## Step 3: Install cc-sessions

```bash
npm install -g github:bluzername/cc-sessions
```

The package is not published on npm (that name belongs to an unrelated project), so install straight from GitHub.

## Step 4: Configure

Set environment variables (or create a `.env` file in the directory you start `cc-sessions` from):

```bash
export TELEGRAM_BOT_TOKEN="your-token-here"
export TELEGRAM_GROUP_ID="-100xxxxxxxxxx"
```

See the configuration table in the [README](../README.md#configuration) for optional variables.

## Step 5: Install Hooks

```bash
cc-sessions setup
```

This will:

1. Create the `~/.cc-sessions/` directory
2. Generate a shared secret for hook authentication (`~/.cc-sessions/secret`)
3. Copy the hook script to `~/.cc-sessions/hook.js`
4. Add `SessionStart`, `UserPromptSubmit`, `Stop`, `Notification` and `SessionEnd` hooks to `~/.claude/settings.json`

Running it again is safe: existing cc-sessions hooks are replaced, never duplicated, and your other hooks are left untouched.

## Step 6: Start

```bash
# Foreground (see logs)
cc-sessions start

# Or as a daemon
cc-sessions daemon start
```

## Step 7: Use Claude Code

Start a Claude Code session normally (inside tmux if you want to reply from your phone). A topic appears in the group as soon as the session starts, gets renamed with your current prompt, and when Claude stops and waits for input you get a notification with inline buttons to respond.

## Troubleshooting

**Bot doesn't respond:**

- Verify the bot token with `curl https://api.telegram.org/bot<TOKEN>/getMe`
- Check the bot is an admin in the group
- Check Forum Topics are enabled

**No notifications:**

- Verify hooks are installed: check `~/.claude/settings.json` for entries pointing at `~/.cc-sessions/hook.js`
- Check the hook server is running: `cc-sessions status`
- Try a manual health check: `curl http://127.0.0.1:7890/health`

**Can't inject responses:**

- Make sure you're running Claude Code inside tmux on the same machine as `cc-sessions`
- Check tmux is available: `tmux list-sessions`
- The pane's current path must match the session's working directory
