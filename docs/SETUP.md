# Setup Guide

## Prerequisites

- Node.js >= 18
- A Telegram account
- Claude Code installed

## Step 1: Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## Step 2: Create a Telegram Supergroup

1. Create a new group in Telegram
2. Go to group settings → "Topics" → Enable
3. Add your bot to the group
4. Make the bot an admin (required for creating/managing topics)
5. Get the group ID:
   - Send a message in the group
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find the `chat.id` (starts with `-100`)

## Step 3: Install cc-sessions

```bash
npm install -g cc-sessions
```

## Step 4: Configure

Set environment variables (or create a `.env` file in your working directory):

```bash
export TELEGRAM_BOT_TOKEN="your-token-here"
export TELEGRAM_GROUP_ID="-100xxxxxxxxxx"
```

## Step 5: Install Hooks

```bash
cc-sessions setup
```

This will:

1. Create `~/.cc-sessions/` directory
2. Generate a shared secret for hook authentication
3. Install the hook script
4. Update `~/.claude/settings.json` with hook configuration

## Step 6: Start

```bash
# Foreground (see logs)
cc-sessions start

# Or as a daemon
cc-sessions daemon start
```

## Step 7: Use Claude Code

Start a Claude Code session normally. When Claude stops and waits for input, you'll get a Telegram notification in the group with inline buttons to respond.

## Troubleshooting

**Bot doesn't respond:**

- Verify the bot token with `curl https://api.telegram.org/bot<TOKEN>/getMe`
- Check the bot is an admin in the group
- Check Forum Topics are enabled

**No notifications:**

- Verify hooks are installed: check `~/.claude/settings.json`
- Check the hook server is running: `cc-sessions status`
- Try a manual hook test: `curl http://localhost:7890/health`

**Can't inject responses:**

- Make sure you're using tmux for your Claude Code sessions
- Check tmux is available: `tmux list-sessions`
