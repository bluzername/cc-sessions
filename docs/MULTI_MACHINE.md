# Multi-Machine Setup

By default, cc-sessions runs on a single machine: the hook POSTs to `localhost:7890`. For monitoring sessions across multiple machines, you need the hook on remote machines to reach the cc-sessions server.

## Option 1: SSH Tunnel (Recommended)

The simplest approach. Create a reverse SSH tunnel from the remote machine to your cc-sessions server.

On the remote machine:
```bash
ssh -R 7890:localhost:7890 your-server
```

This forwards the remote machine's `localhost:7890` to your server's `localhost:7890`. The hook script on the remote machine POSTs to its own localhost, which tunnels back to your server.

For persistent tunnels, use autossh:
```bash
autossh -M 0 -f -N -R 7890:localhost:7890 your-server
```

## Option 2: Tailscale / WireGuard

If your machines are on a Tailscale or WireGuard network:

1. On the cc-sessions server, bind to the Tailscale IP:
   ```bash
   # In your .env or environment
   HOOK_HOST=100.x.x.x
   ```

2. On remote machines, configure the hook to target the server's Tailscale IP:
   ```json
   // ~/.cc-sessions/config.json
   {
     "host": "100.x.x.x",
     "port": 7890
   }
   ```

3. Copy the shared secret from the server to each remote machine:
   ```bash
   scp server:~/.cc-sessions/secret ~/.cc-sessions/secret
   ```

## Option 3: Direct Network

If machines are on the same LAN:

1. Bind the hook server to all interfaces:
   ```bash
   HOOK_HOST=0.0.0.0
   ```

2. Configure remote hooks to use the server's LAN IP:
   ```json
   // ~/.cc-sessions/config.json on remote machines
   {
     "host": "192.168.1.100",
     "port": 7890
   }
   ```

**Note:** Only use this on trusted networks. The hook server has secret-based auth but runs over HTTP.

## Verifying Multi-Machine Setup

1. On the remote machine, test the connection:
   ```bash
   curl http://localhost:7890/health  # If using SSH tunnel
   curl http://100.x.x.x:7890/health  # If using Tailscale
   ```

2. Start a Claude Code session on the remote machine. It should appear as a new topic in your Telegram group with the remote machine's hostname.
