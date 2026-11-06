# FitApp

A fitness-challenge PWA: users sign in with Google, join step/weight challenges with friends, sync data from Google Fit / Fitbit, compete on leaderboards, and chat in challenge rooms (Matrix/Synapse) with a motivational bot.

Live at `https://fitapp.herringm.com` (backend `https://fitappbackend.herringm.com`), served from a Synology NAS through an existing Cloudflare tunnel. See [docs/AI_CONFIGURATION_REFERENCE.md](docs/AI_CONFIGURATION_REFERENCE.md) before changing hostnames, ports or tunnels.

## Repository layout

```
fitapp-frontend/   React + Vite + Tailwind PWA (service worker in public/sw.js)
fitapp-backend/    Express + Mongoose API (routes/, models/, services/)
  scripts/         One-off DB maintenance and migration scripts (run inside the backend container)
fitapp-bot/        Matrix bot that posts motivation/milestone messages to challenge chats
production/        Prod stack: docker-compose + Dockerfiles that build from GitHub `main`
development/       Dev stack: docker-compose with local volume mounts and hot reload
scripts/           NAS helper scripts (ssh/sync/docker), used by .cursor/functions.json
design/            Design-system JSON and source app icons
docs/              Workflow, deployment and feature docs
deploy-both.sh     Deploys production then development
```

## Stack

| Service    | Prod port | Dev port |
|------------|-----------|----------|
| Frontend   | 5173      | 5174     |
| Backend    | 3000      | 3001     |
| Synapse    | 8008      | 8009     |
| MongoDB    | internal  | 27017    |

## Getting started

- **Development:** [development/README.md](development/README.md) — `cd development && cp .env.example .env && ./deploy.sh`
- **Production:** [production/README.md](production/README.md) — builds images from the `main` branch on GitHub, so push before deploying.
- **Git workflow:** [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) (`feature/*` → `develop` → `main`).

## Docs

- Deployment: [docs/deployment/](docs/deployment/) (full deploy guide, environment variables, NAS SSH setup)
- Features: [docs/features/](docs/features/) (chat, photo upload, design system, icon versioning, PWA updates)
- Bot messages: [fitapp-bot/AUTOMATED_MESSAGES.md](fitapp-bot/AUTOMATED_MESSAGES.md)
- Changes: [CHANGELOG.md](CHANGELOG.md)
