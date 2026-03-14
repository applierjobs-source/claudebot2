# Infrastructure Overview

## Stack Summary

| Layer | Technology |
|-------|------------|
| Source & CI/CD | GitHub (repo) + GitHub Actions |
| Container registry | GitHub Container Registry (ghcr.io) |
| Backend + Web | Railway (single project or two services) |
| Bot runtimes | DigitalOcean Droplets (Docker host) |
| Database | Hosted PostgreSQL (Railway or Neon/Supabase) |

## GitHub

- **Repository**: Single monorepo (e.g. `claudebot2`) with folders: `web/`, `api/`, `agent-runtime/`, `docs/`.
- **Branches**: `main` for production; optional `develop` for staging.
- **Secrets**: `ANTHROPIC_API_KEY`, `DO_TOKEN`, `DATABASE_URL`, `RAILWAY_*` as needed, `GHCR_TOKEN` for push (or use GITHUB_TOKEN).

## GitHub Actions (CI/CD)

- **On push to main** (or tag):
  - Build `agent-runtime` Docker image (Dockerfile in `agent-runtime/`).
  - Run tests for api and agent-runtime if present.
  - Push image to GHCR: `ghcr.io/<org>/claudebot-agent:latest` (and optionally `:sha-xxx`).
- **Deploy to Railway**: Triggered by push or via Railway’s GitHub integration (deploy from `main` for `api` and `web`).

## GitHub Container Registry

- Image: `ghcr.io/<org>/claudebot-agent:latest`.
- DigitalOcean pulls this image when starting bot containers (no need to run Docker on your PC).

## Railway

- **Services**:
  - **api**: Backend (Node.js). Env: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `DO_TOKEN`, `JWT_SECRET`, `API_URL` (public backend URL for bots to send logs).
  - **web**: Frontend (static or Node serve). Build: build frontend; root: `dist` or similar.
- **PostgreSQL**: Add Railway PostgreSQL plugin; connect via `DATABASE_URL`.
- **Domains**: Assign public URLs to api and web (e.g. `api.yourapp.railway.app`, `yourapp.railway.app`).

## DigitalOcean

- **Droplets**: Ubuntu 22.04; Docker installed (via user data or pre-built image).
- **Provisioning flow**:
  1. Backend calls DO API: create droplet (or reuse pool of droplets).
  2. On droplet: install Docker if needed, pull `ghcr.io/.../claudebot-agent:latest`, run container with env: `BOT_ID`, `API_URL`, `LOG_TOKEN` (or API key), template config.
  3. Backend stores droplet id and container id in `bots` table for later stop/restart/delete.
- **MVP**: One droplet that runs multiple bot containers; scale later with more droplets or DO App Platform / Kubernetes if needed.

## No Containers on Personal Machine

- All images are built in GitHub Actions and stored in GHCR.
- Bots run only on DO droplets; backend and web run on Railway. Your machine is only for development.
