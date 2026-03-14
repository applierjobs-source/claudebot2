# Claude Bot Platform — System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USERS (Browser)                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         RAILWAY (Hosted)                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │   Web App (Frontend)  │  │   Backend API        │  │   Log Ingest / WS    │  │
│  │   React + Vite       │  │   Node.js + Express   │  │   (optional)         │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘  │
│             │                         │                         │               │
│             └─────────────────────────┼─────────────────────────┘               │
│                                       │                                          │
│                                       ▼                                          │
│                         ┌─────────────────────────┐                              │
│                         │  PostgreSQL (Hosted)    │                              │
│                         │  users, bots, logs, etc. │                              │
│                         └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ DigitalOcean        │    │ DigitalOcean        │    │ Anthropic            │
│ Droplet 1           │    │ Droplet 2           │    │ Claude API           │
│ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │                     │
│ │ Docker Engine    │ │    │ │ Docker Engine    │ │    │                     │
│ │ ┌─────────────┐  │ │    │ │ ┌─────────────┐  │ │    │                     │
│ │ │ Bot A       │  │ │    │ │ │ Bot C       │  │ │    │                     │
│ │ │ (container) │  │ │    │ │ │ (container) │  │ │    │                     │
│ │ └─────────────┘  │ │    │ │ └─────────────┘  │ │    │                     │
│ │ ┌─────────────┐  │ │    │ │                  │ │    │                     │
│ │ │ Bot B       │  │ │    │ │                  │ │    │                     │
│ │ └─────────────┘  │ │    │ │                  │ │    │                     │
│ └─────────────────┘ │    │ └─────────────────┘ │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Component Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **Web App** | Auth UI, dashboard, bot CRUD UI, template selection, log viewer, start/stop/restart/delete. |
| **Backend API** | Auth (JWT), bot lifecycle, template CRUD, DO provisioning (create droplet, run container), log ingestion, usage/billing, rate limits, safety (kill switch, limits). |
| **PostgreSQL** | Users, bots, templates, runs, logs, memory, usage, billing. |
| **DigitalOcean Droplets** | Run Docker; each droplet can host multiple bot containers. Backend uses DO API to create droplets and run containers from GHCR image. |
| **Bot Container** | Single bot process: observe → think (Claude) → act (tools) → log → repeat. Includes tool layer (browser, HTTP, files, etc.), state persistence, logging to backend. |
| **Claude API** | Reasoning and tool-calling; each bot calls Claude with system prompt + tools; runtime executes tools and feeds results back. |

## Data Flow

1. **Create Bot**: User selects template → Backend creates bot record → Backend creates/selects DO droplet → Backend runs container with bot id + config + API URL for logs → Container starts agent loop and POSTs logs to backend.
2. **View Logs**: Frontend requests logs for bot → Backend reads from DB (or log store) → Stream or paginate to UI.
3. **Stop Bot**: User clicks stop → Backend marks bot stopped, optionally calls DO to stop container → Container receives signal or polls and exits loop.

## Security & Isolation

- Each bot runs in its own container; no shared filesystem between bots.
- Backend authenticates all requests (JWT).
- Bot containers receive only: bot id, template config, and API key for logging; Claude API key is injected by backend from server-side config.
- Rate limits: per-user bot count, per-bot API calls, token caps, spend caps.
