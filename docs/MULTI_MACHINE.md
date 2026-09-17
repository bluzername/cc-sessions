# Multi-Machine Setup

By default cc-sessions runs on a single machine: the hook script POSTs to `127.0.0.1:7890` and the hook server listens on `127.0.0.1` only. To monitor sessions on other machines, the hook on each remote machine must reach the cc-sessions server, and the remote machine needs the same shared secret.

## Step 1: Copy the shared secret

On each remote machine:

```bash
mkdir -p ~/.cc-sessions
scp your-server:~/.cc-sessions/secret ~/.cc-sessions/secret
chmod 600 ~/.cc-sessions/secret
```

Then run `cc-sessions setup` on the remote machine so its Claude Code hooks are installed. (It will keep the copied secret rather than generating a new one.) You do not need to start `cc-sessions` on the remote machine.

## Option 1: SSH Reverse Tunnel (Recommended)

Create a reverse SSH tunnel from the remote machine to the machine running cc-sessions. This works over LAN, Tailscale, WireGuard or the public internet, and needs no extra configuration because the hook keeps talking to its own `localhost:7890`.

On the remote machine:

```bash
ssh -R 7890:127.0.0.1:7890 your-server
```

For a persistent tunnel, use autossh:

```bash
autossh -M 0 -f -N -R 7890:127.0.0.1:7890 your-server
```

## Option 2: Point the hook at a reachable address

The hook script reads `~/.cc-sessions/config.json` on the remote machine:

```json
{
  "host": "100.x.x.x",
  "port": 7890
}
```

Because the hook server itself only binds to `127.0.0.1`, something on the server has to forward that address to it. On the machine running cc-sessions, for example with socat:

```bash
socat TCP-LISTEN:7890,bind=100.x.x.x,fork,reuseaddr TCP:127.0.0.1:7890
```

**Note:** Only do this on a trusted network such as Tailscale or WireGuard. The hook server authenticates with the shared secret but speaks plain HTTP.

## Verifying

1. On the remote machine, test the connection:

   ```bash
   curl http://127.0.0.1:7890/health   # SSH tunnel
   curl http://100.x.x.x:7890/health   # forwarded address
   ```

2. Start a Claude Code session on the remote machine. It should appear as a new topic in your Telegram group named after the remote machine's hostname.

3. Replies from Telegram are injected via tmux on the machine running cc-sessions only, so for remote sessions you get the copyable `tmux send-keys` fallback instead.
