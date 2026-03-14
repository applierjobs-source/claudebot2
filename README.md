# Claude Bot Platform

SaaS platform where users can spin up **autonomous Claude bots** that run continuously in isolated cloud environments (DigitalOcean Droplets). Each bot runs an observe → think (Claude) → act (tools) → log loop with browser automation, HTTP, files, and memory.

## Architecture

- **Frontend (React + Vite)** – Auth, dashboard, create bot, template selection, logs viewer, start/stop/restart/delete, activity page. Deploy on **Railway**.
- **Backend API (Node.js + Express)** – Auth (JWT), bot lifecycle, templates, **DigitalOcean** provisioning (SSH + Docker), log ingestion, memory API. Deploy on **Railway**.
- **Bot runtime (Python)** – Claude agent loop, tool registry (browse, extract, HTTP, files, memory, complete), Playwright browser, logging to backend. Runs in **Docker** on **DigitalOcean Droplets**.
- **PostgreSQL** – Hosted (e.g. Railway). Tables: users, bots, bot_templates, bot_runs, bot_logs, bot_memory, usage, billing.
- **GitHub** – Source and CI/CD. **GitHub Actions** build and push the agent Docker image to **GHCR** (`ghcr.io/<org>/claudebot-agent:latest`).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/AGENT_RUNTIME.md](docs/AGENT_RUNTIME.md), [docs/PROVISIONING.md](docs/PROVISIONING.md).

## Project structure

```
├── api/                 # Backend (Node.js, Prisma, Express)
│   ├── prisma/
│   └── src/
├── agent-runtime/       # Python Claude agent (Docker image)
│   ├── tools/
│   ├── agent.py
│   └── Dockerfile
├── web/                 # Frontend (React, Vite)
├── docs/
└── .github/workflows/   # CI and build agent image
```

## Local development

### Prerequisites

- Node 18+, npm
- Python 3.11+ (for agent locally)
- Docker (optional, for agent image)
- PostgreSQL (or use Railway/Neon URL)

### Backend

```bash
cd api
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API runs at `http://localhost:3001`.

### Frontend

```bash
cd web
npm install
npm run dev
```

Web runs at `http://localhost:5173` and proxies `/api` and `/health` to the API.

### Agent runtime (local test)

```bash
cd agent-runtime
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
playwright install chromium
export ANTHROPIC_API_KEY=... API_URL=http://localhost:3001 LOG_TOKEN=... CONFIG_JSON='{"systemPrompt":"...","allowedTools":["get_memory","complete"]}'
python main.py
```

### Docker (agent)

```bash
cd agent-runtime
docker build -t claudebot-agent .
docker run --rm -e ANTHROPIC_API_KEY=... -e API_URL=... -e LOG_TOKEN=... -e CONFIG_B64=$(echo -n '{"systemPrompt":"You are a test agent.","allowedTools":["complete"]}' | base64) claudebot-agent
```

## Deployment

### Railway

1. Create a Railway project. Add **PostgreSQL** plugin; note `DATABASE_URL`.
2. Add two services (or one monorepo root with two start commands):
   - **api**: Root `api/`, build `npm install && npx prisma generate && npm run build`, start `node dist/index.js`. Env: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `DO_TOKEN`, `DO_DROPLET_ID`, `DO_SSH_PRIVATE_KEY`, `API_URL` (public API URL), `AGENT_IMAGE` (e.g. `ghcr.io/<org>/claudebot-agent:latest`).
   - **web**: Root `web/`, build `npm install && npm run build`, start static serve of `dist/` (e.g. `npx serve dist -s`). Env: `VITE_API_URL` = public API URL (e.g. `https://api.yourapp.railway.app`).
3. Connect GitHub repo; deploy from `main`.

### DigitalOcean

1. Create an **Ubuntu 22.04** Droplet. Install Docker (e.g. one-click or user data).
2. Note the Droplet ID and get its IP. Add **SSH key** to Railway (or store `DO_SSH_PRIVATE_KEY` in Railway secrets).
3. In Railway API env set: `DO_DROPLET_ID`, `DO_SSH_PRIVATE_KEY`, `DO_TOKEN` (DO API token), `API_URL` (e.g. `https://api.yourapp.railway.app`).
4. When a user creates a bot, the API SSHs into the droplet and runs `docker run ... ghcr.io/<org>/claudebot-agent:latest` with `BOT_ID`, `API_URL`, `LOG_TOKEN`, `CONFIG_B64`, `ANTHROPIC_API_KEY`.

### GitHub Actions

- **CI** (`.github/workflows/ci.yml`): On push/PR to `main`, install API deps, Prisma generate, build API; build agent Docker image (no push).
- **Build agent** (`.github/workflows/build-agent.yml`): On push to `main` (with `agent-runtime/` changes) or manual, build and push agent image to `ghcr.io/<owner>/claudebot-agent:latest`.

Use `AGENT_IMAGE=ghcr.io/<owner>/claudebot-agent:latest` on Railway so new containers pull the latest image.

## Bot templates

Seeded via `api/prisma/seed.ts`:

- **Crypto Faucet Hunter** – Discover and document crypto faucets.
- **Airdrop Discovery Bot** – Find and track airdrop opportunities.
- **Website Rebuild Bot** – Analyze sites and produce structure/content reports.
- **Domain Discovery Bot** – Discover and catalog domains from seed URLs.

Templates define system prompt, allowed tools, runtime/token/spend limits, and optional startup actions.

## Security and limits

- Per-user bot limit (e.g. 10).
- Per-bot: max runtime, token cap, spend cap (enforced in agent loop).
- Log ingestion and memory API require valid `X-Log-Token` (per-bot, generated by backend).
- Containers run in isolation on DO; no shared filesystem between bots.

## License

MIT.
