# Sentinel Pocket

[![CI](https://github.com/alexandrmotologa/sentinel-pocket/actions/workflows/ci.yml/badge.svg)](https://github.com/alexandrmotologa/sentinel-pocket/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-22%2B%20%7C%2024-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/fastify-4.x-black.svg)](https://fastify.dev/)
[![Telegram](https://img.shields.io/badge/telegram-Mini%20App%20%26%20Bot-229ED9.svg)](https://core.telegram.org/bots/webapps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sentinel Pocket is a mobile incident cockpit and Telegram Mini App companion for [alexandrmotologa/sentinel](https://github.com/alexandrmotologa/sentinel) and [alexandrmotologa/canarymesh](https://github.com/alexandrmotologa/canarymesh). It provides cluster health surveillance, real-time alert triage via Telegram Long Polling, and one-tap remediation runbooks directly from a mobile device.

```
                  +----------------------------------------------+
                  |         Sentinel Monitoring Engine           |
                  |     (alexandrmotologa/sentinel daemon)       |
                  |  GET /metrics (Prometheus) | GET /healthz    |
                  +-----------------------+----------------------+
                                          | Polling / Health Ticks
                                          v
+--------------------------------------------------------------------------------+
| Sentinel Pocket Server (Fastify + grammY + SQLite)                             |
|                                                                                |
|  +---------------------+   +---------------------+   +-----------------------+ |
|  | Cryptographic Auth  |   | Health & Anomaly    |   | Runbook Action Engine | |
|  | HMAC-SHA256         |   | State Machine       |   | Audit Log in SQLite   | |
|  +---------------------+   +---------------------+   +-----------------------+ |
|                                       |                                        |
|             +-------------------------+-------------------------+              |
|             |                                                   |              |
|             v                                                   v              |
|  +--------------------------+                         +---------------------+  |
|  | Server-Sent Events (SSE) |                         | Long Polling Runner |  |
|  | /api/stream (15s ping)   |                         | grammY v1.x         |  |
|  +--------------------------+                         +---------------------+  |
+-------------+---------------------------------------------------+--------------+
              |                                                   |
              | Real-time Telemetry                               | Alert Dispatch
              v                                                   v
+--------------------------------------------------------------------------------+
| Telegram Mobile Client                                                         |
|                                                                                |
|   1. Bot Chat:                                                                 |
|      - Inline alerts with triage buttons                                       |
|      - Commands: /start, /status, /alerts, /help                               |
|                                                                                |
|   2. Telegram Mini App (React 19 + Tailwind CSS + @twa-dev/sdk):               |
|      - Service grid with SVG latency sparklines (p50 / p95 / p99)              |
|      - Incident triage with stack trace & status code breakdowns               |
|      - 1-Tap runbooks: Container Restart, Canary Rollback, Cache Flush         |
|      - Browser simulator mode for standalone local development                 |
+--------------------------------------------------------------------------------+
```

## Features

- **Long Polling Telegram Bot:** Operates behind firewalls and NAT without public webhooks, domain names, or reverse proxies.
- **Cryptographic initData Verification:** Implements Telegram's HMAC-SHA256 validation algorithm with 24-hour timestamp freshness checks to block forged requests.
- **Zero-Dependency Persistence:** Uses Node's built-in SQLite engine (`node:sqlite`) to record latency ticks, incident transitions, and runbook execution logs.
- **Live Server-Sent Events (SSE):** Streams latency updates and state transitions over `/api/stream` with periodic keep-alive comments.
- **Integrated Runbook Automation:** Triggers container restarts, cache flushes, and canary rollbacks against `canarymesh`.
- **In-Browser TMA Simulator:** Automatically displays a phone mockup with theme switching and mock user selection when opened in a standard web browser.
- **Full Mock Mode:** Simulates network latency jitter, synthetic service failures, and alert broadcasts out of the box.

## Ecosystem Bridge

Sentinel Pocket connects directly into the broader infrastructure ecosystem:

1. **[Sentinel Uptime Daemon](https://github.com/alexandrmotologa/sentinel):** Sentinel Pocket queries Sentinel's Prometheus `/metrics` and JSON `/healthz` endpoints. When Sentinel is not reachable, Sentinel Pocket falls back to its local mock engine.
2. **[CanaryMesh](https://github.com/alexandrmotologa/canarymesh):** Operators can roll back anomalous canary deployments or shift traffic weights directly from the Mini App triage card.

## Project Structure

```
sentinel-pocket/
├── docs/                      # Architecture, API specifications, and runbooks
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── RUNBOOKS.md
│   └── TELEGRAM_SETUP.md
├── server/                    # Node.js + TypeScript Fastify API & grammY bot
│   ├── src/
│   │   ├── api/               # REST routes and SSE stream handler
│   │   ├── bot/               # Telegram bot commands, keyboards, and runner
│   │   ├── monitor/           # Health check loop, SQLite store, mock engine
│   │   ├── security/          # Telegram initData HMAC verification
│   │   ├── config.ts          # Validated runtime environment variables
│   │   ├── types.ts           # Shared TypeScript interfaces
│   │   └── index.ts           # Fastify bootstrap and graceful shutdown
│   └── test/                  # Test suites for auth, store, and API
├── web/                       # React 19 Telegram Mini App
│   ├── src/
│   │   ├── components/        # Service cards, sparklines, triage, runbooks
│   │   ├── hooks/             # Telegram WebApp SDK and SSE event hooks
│   │   ├── styles/            # Tailwind CSS and Telegram theme variables
│   │   ├── App.tsx            # Main cockpit application
│   │   └── main.tsx           # Entry point
│   └── vite.config.ts
├── Dockerfile                 # Multi-stage container build
├── docker-compose.yml         # Container orchestration setup
└── .env.example               # Environment variable template
```

## Quick Start

### 1. Standalone Local Development (Mock Mode)

You can run Sentinel Pocket locally without a Telegram Bot token or public domain.

```bash
# Clone the repository
git clone https://github.com/alexandrmotologa/sentinel-pocket.git
cd sentinel-pocket

# Copy environment settings
cp .env.example .env

# Install dependencies and build frontend
cd web
npm install
npm run build
cd ..

# Install backend dependencies and run
cd server
npm install
npm run dev
```

Open `http://localhost:8080` in your web browser. The built-in Telegram Mini App Simulator will display the cockpit interface with simulated services, synthetic latency ticks, and active incident alerts.

### 2. Live Telegram Bot & Mini App Mode

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram and create a new bot to receive your `TELEGRAM_BOT_TOKEN`.
2. Configure a public HTTPS URL (via cloud hosting, Cloudflare Tunnel, or ngrok):
   ```bash
   ngrok http 8080
   ```
3. Set your Mini App URL in `@BotFather` using `/newapp` or `/setmenubutton`, pointing to your HTTPS forwarding URL.
4. Update `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   WEB_APP_URL=https://your-domain.ngrok-free.app
   MOCK_MODE=false
   ALLOWED_TELEGRAM_USERS=your_telegram_user_id
   ```
5. Start the server:
   ```bash
   cd server
   npm run start
   ```
6. Open your bot in Telegram and send `/start`.

## Telegram Commands

| Command | Description |
|---|---|
| `/start` | Displays the welcome card and opens the Sentinel Pocket Mini App button. |
| `/status` | Summarizes service uptime percentages and overall cluster status. |
| `/alerts` | Lists unacknowledged incidents with inline triage actions. |
| `/help` | Explains available bot commands and runbook capabilities. |

## Runbook Remediation Actions

When an incident triggers an alert, operators can run remediation actions directly from the bot or Mini App:

- **Restart Container:** Sends a restart signal to the targeted service deployment.
- **Rollback Canary:** Calls the `canarymesh` API to route 100% of traffic back to the stable baseline deployment.
- **Flush Cache:** Purges stale cache keys in Redis or in-memory caches.
- **Silence Alert:** Suppresses notifications for 1 hour or 24 hours while an investigation is underway.

Each action logs an entry to the SQLite database with the operator's Telegram ID, timestamp, and status code.

## Docker Deployment

Build and run the entire stack with Docker Compose:

```bash
docker compose up --build -d
```

The container packages the compiled React application, Fastify API, and SQLite database into a single image.

## Testing

Run the test suite:

```bash
cd server
npm test
```

The tests verify:
- HMAC-SHA256 signature calculation and replay detection
- SQLite migrations, metrics insertion, and audit logging
- REST API response structures and error codes

## License

MIT. Created by Alexandr Motologa.
