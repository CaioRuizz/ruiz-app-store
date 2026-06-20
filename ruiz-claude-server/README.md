# Claude Server

Self-hosted Claude Code server with a web UI. Run Claude Code on your server and control it from any device (Mac, iPad, phone). Sessions persist when you disconnect — reconnect from another device and pick up where you left off.

## Umbrel install

1. Add this repo to Umbrel's community app stores:
   **Umbrel → App Store → Community App Stores → Add store**

2. Install **Claude Server** from the store

3. Open the app — you'll be redirected to a one-time setup page to set an admin password and paste your Anthropic API key

4. Done. Create sessions and connect from any device.

### Manual install (sideload)

If you want to sideload directly:

```bash
# On your Umbrel server
cd ~/umbrel/apps
git clone <repo> claude-server
~/umbrel/scripts/app install claude-server
```

## Generic Docker Compose (non-Umbrel)

```bash
git clone <repo> claude-server && cd claude-server
PORT=80 docker compose up -d --build
# open http://your-server
```

The `APP_PORT` / `APP_DATA_DIR` env vars are injected by Umbrel automatically. For standalone use, `PORT` overrides the exposed port (default 3200) and data is stored in `./umbrel-data/`.

## Sessions

Each session is a persistent Claude Code process on the server. Closing your browser doesn't kill it. Reconnect from any device — the terminal replays recent output so you're back in context instantly.

## Workspaces

Projects live in `APP_DATA_DIR/workspaces` (on Umbrel: `~/umbrel/app-data/claude-server/workspaces`).

To use existing server directories, mount them in `docker-compose.yml`:

```yaml
services:
  backend:
    volumes:
      - "${APP_DATA_DIR}/data:/data"
      - "${APP_DATA_DIR}/workspaces:/workspaces"
      - /path/to/your/project:/workspaces/my-project   # add this
```

## HTTPS

Umbrel provides HTTPS automatically via its built-in Tor hidden service and local domain (`http://umbrel.local`). No extra configuration needed.

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (in another terminal)
cd frontend && npm install && npm run dev
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```
