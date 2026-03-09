# SSH Portfolio — Anton Brunel

An interactive terminal portfolio accessible via SSH.
Built with Node.js + TypeScript. No web browser needed.

```
ssh -p 2222 portfolio@your-host
```

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode (auto-compiles TypeScript)
npm run dev
```

The server starts on port **2222** by default.

```bash
# Connect locally
ssh -p 2222 portfolio@localhost

# Accept the fingerprint warning on first connect (type "yes")
# Any username works — authentication is open
```

Press `← →` to navigate tabs, `ENTER` to open, `Q` to quit.

---

## Production build

```bash
npm run build    # compiles TypeScript → dist/
npm start        # runs dist/server.js
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SSH_PORT` | `2222` | Port the SSH server listens on |
| `PORT` | `2222` | Fallback port (used by some platforms) |
| `SSH_HOST_KEY` | — | Base64-encoded RSA private key PEM (for Zeabur/Docker) |
| `HOST_KEY_PATH` | `./keys/host_key` | Path to host key file |

If `SSH_HOST_KEY` is not set and no key file exists, the server generates one automatically at startup (stored in `keys/host_key`).

**Important:** On ephemeral deployments (Zeabur, Fly, etc.) the key is re-generated on every restart, which causes SSH fingerprint warnings for returning visitors. To avoid this, set `SSH_HOST_KEY` as a persistent secret (see below).

---

## Zeabur deployment

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ssh-portfolio.git
git push -u origin main
```

### Step 2 — Create Zeabur project

1. Go to [zeabur.com](https://zeabur.com) → New Project
2. Add service → Deploy from GitHub → select your repo
3. Zeabur detects the Dockerfile automatically

### Step 3 — Expose the SSH port

In Zeabur service settings → **Networking** → add a TCP port: `2222`.
Zeabur will assign a public hostname and port (e.g. `your-service.zeabur.app:12345`).

### Step 4 — Stable host key (recommended)

Generate a key locally and encode it:

```bash
npm run generate-keys
# Then base64-encode it:
cat keys/host_key | base64
```

Copy the output. In Zeabur → **Variables**, add:

```
SSH_HOST_KEY=<paste base64 string here>
```

This ensures the same fingerprint across restarts.

### Step 5 — Connect

```bash
ssh -p 32013 portfolio@43.157.1.94
```

Or add to `~/.ssh/config` for a cleaner command:

```
Host antton
    HostName 43.157.1.94
    Port 32013
    User portfolio
```

```bash
ssh antton
```

---

## Customise content

All content lives in **[src/content.ts](src/content.ts)**:

- `ASCII_PORTRAIT` — the ASCII art displayed on the home screen
- `CONTENT.name` / `CONTENT.tagline` — header text
- `CONTENT.pitch` — home screen right-side copy
- `CONTENT.about` — About section lines
- `CONTENT.projects` — array of `{ name, tags, description[] }`
- `CONTENT.contact` — array of `{ label, value }`

After editing, rebuild with `npm run build` or restart `npm run dev`.

---

## Architecture

```
src/
├── server.ts      SSH server — accepts connections, spawns sessions
├── app.ts         App state machine + screen renderer
├── renderer.ts    ANSI utilities (Frame builder, colors, helpers)
└── content.ts     All portfolio content

scripts/
└── generate-keys.ts   One-time RSA key generation utility

keys/              Auto-generated at runtime (gitignored)
dist/              Compiled JavaScript (gitignored)
```

No shell access is ever granted. `exec`, `subsystem`, and `sftp` requests are rejected at the SSH session layer.
