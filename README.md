<p align="center">
  <img src="docs/images/logo.png?raw=true" alt="Sentinel Pocket Logo" width="130" style="border-radius: 24px;" />
</p>

<h1 align="center">Sentinel Pocket</h1>

<p align="center">
  <b>Mobile Incident Cockpit & Telegram Mini App Companion for SRE & DevOps Engineers</b>
</p>

<p align="center">
  <a href="https://github.com/alexandrmotologa/sentinel-pocket/actions/workflows/ci.yml"><img src="https://github.com/alexandrmotologa/sentinel-pocket/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-22%2B%20%7C%2024-blue.svg" alt="Node" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-5.8-blue.svg" alt="TypeScript" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19-61dafb.svg" alt="React 19" /></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/fastify-4.x-black.svg" alt="Fastify" /></a>
  <a href="https://core.telegram.org/bots/webapps"><img src="https://img.shields.io/badge/telegram-Mini%20App%20%26%20Bot-229ED9.svg" alt="Telegram" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" /></a>
</p>

Sentinel Pocket is a mobile incident cockpit and Telegram Mini App companion for [alexandrmotologa/sentinel](https://github.com/alexandrmotologa/sentinel) and [alexandrmotologa/canarymesh](https://github.com/alexandrmotologa/canarymesh). It provides cluster health surveillance, real-time alert triage via Telegram Long Polling, and one-tap remediation runbooks directly from a mobile device.

## Mobile Cockpit Interface

Sentinel Pocket operates as both a responsive Telegram Mini App and a standalone browser cockpit with an integrated device simulator:

| Live SRE Telemetry & Triage Cockpit | Instant Synthetic Health Probe |
|:---:|:---:|
| <img src="docs/images/screenshot_cockpit.png?raw=true" alt="Cockpit Overview" width="540" /> | <img src="docs/images/screenshot_probe.png?raw=true" alt="Instant Probe" width="540" /> |
| *Real-time latency sparklines, SLO burn rate badges, and on-call handover banner.* | *Ad-hoc HTTP/HTTPS/TCP probing with DNS, TTFB, and SSL certificate expiration.* |

| Root Cause Explainer & Diagnostics | 1-Tap Incident Post-Mortem Generator |
|:---:|:---:|
| <img src="docs/images/screenshot_diagnostics.png?raw=true" alt="Diagnostics Engine" width="540" /> | <img src="docs/images/screenshot_postmortem.png?raw=true" alt="Post-Mortem Generator" width="540" /> |
| *Automated 5xx spike analysis with confidence score and recommended runbook.* | *Structured Markdown post-mortem with downtime calculation and Telegram share.* |

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
- **Zero-Dependency Persistence:** Uses Node's built-in SQLite engine (`node:sqlite`) to record latency ticks, incident transitions, runbooks, maintenance windows, and on-call rotations.
- **Live Server-Sent Events (SSE):** Streams latency updates and state transitions over `/api/stream` with periodic keep-alive comments.
- **Instant Health Probe Tool:** Run ad-hoc HTTP/HTTPS/TCP probes from the app or bot (`/probe`) with full DNS, TCP, TLS handshake, TTFB waterfall timing, and SSL certificate expiration checks.
- **Root Cause Explainer (Diagnostic Engine):** Evaluates error spikes, status distributions, and latency degradation to present probable causes with actionable runbook recommendations.
- **SLO & Burn Rate Cockpit:** Monitors 30-day rolling error budgets and multi-window burn rate multipliers with real-time badges.
- **1-Tap Post-Mortem Generator:** Produces structured Markdown incident reports with root cause summaries and timeline data, ready for one-tap Telegram sharing.
- **Scheduled Maintenance Windows:** Schedule planned downtime windows that automatically suppress alert notifications.
- **On-Call Shift Cockpit & Handover:** Manage on-call rotations via `/oncall` and execute instant shift transfers with `/handover`.
- **Custom Webhook Runbooks:** Trigger external webhook endpoints or built-in remediation actions (container restarts, cache flushes, canary rollbacks).
- **In-Browser TMA Simulator:** Automatically displays a phone mockup with theme switching and mock user selection when opened in a standard web browser.

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
| `/status` | Summarizes service uptime percentages, burn rates, and overall cluster status. |
| `/alerts` | Lists unacknowledged incidents with inline triage actions and post-mortem shortcuts. |
| `/probe <url>` | Runs an instant synthetic probe against any HTTP/HTTPS target with DNS, TTFB, and SSL metrics. |
| `/oncall` | Shows who is currently on-call, escalation contacts, and shift end times. |
| `/handover <user>` | Transfers on-call duty to a new operator and logs the handover event. |
| `/postmortem <id>` | Generates a structured Markdown post-mortem for the specified incident ID. |
| `/help` | Explains available bot commands, probe options, and runbook capabilities. |

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
