# Sentinel Pocket Architecture

This document describes the technical design, data flows, and security model of Sentinel Pocket.

## System Topology

Sentinel Pocket bridges distributed infrastructure monitoring with mobile incident response. It is designed around three main layers:

```
+-------------------------------------------------------------+
| External Layer: Surveillance & Upstream Services            |
| - Sentinel Daemon (Python asyncio monitoring)               |
| - CanaryMesh Deployment Engine                              |
| - Real or Mock Target Endpoints (HTTP/TCP)                  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Core Daemon Layer (Node.js 22/24 + Fastify + grammY)        |
| - Long Polling Runner (grammY)                              |
| - Health Check Loop & Anomaly State Machine                 |
| - SQLite Persistence (node:sqlite)                          |
| - Cryptographic Verifier (HMAC-SHA256)                      |
| - SSE Broadcaster (Server-Sent Events)                      |
| - Static Asset Provider (Fastify Static)                    |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Client Layer: Mobile Incident Cockpit                       |
| - Telegram Bot Inline Keyboards                             |
| - Telegram Mini App (React 19, Tailwind, @twa-dev/sdk)      |
| - Browser Simulator Frame for local development             |
+-------------------------------------------------------------+
```

## Core Subsystems

### 1. Cryptographic Authentication (`server/src/security/auth.ts`)

Every request originating from the Telegram Mini App carries an `initData` query string. This string contains user identity, authentication date, and a cryptographic `hash`.

The server validates this payload using Telegram's algorithm:
1. Parse parameters and remove the `hash` field.
2. Sort parameters alphabetically by key.
3. Build a `data_check_string` by joining keys and values with newline characters.
4. Derive a secret key by computing `HMAC-SHA256('WebAppData', botToken)`.
5. Compute `HMAC-SHA256(secretKey, data_check_string)`.
6. Compare the computed digest with the received hash.
7. Verify that `auth_date` is no older than 86,400 seconds (24 hours) to prevent replay attacks.

When `MOCK_MODE=true` is enabled, authentication checks accept mock signatures to simplify local development outside Telegram.

### 2. Monitoring & State Machine (`server/src/monitor/`)

The monitoring layer periodically probes registered services or evaluates metrics received from a live Sentinel daemon.

- **Status Transition Logic:**
  - `HEALTHY`: Latency is within SLA thresholds and status code is HTTP 2xx.
  - `DEGRADED`: Latency exceeds threshold (e.g. > 1,500ms) or intermittent errors are detected.
  - `DOWN`: Consecutive probe failures or explicit error responses (e.g. HTTP 500, 502, 504).
- **Flap Protection:** State changes require confirmation across consecutive check windows before alerting the operator, avoiding alert noise from transient network hiccups.
- **SSE Broadcast:** Whenever a check completes or a status transition occurs, an event is emitted to the SSE broker for real-time delivery to connected Mini Apps.

### 3. Telegram Bot Engine (`server/src/bot/`)

The bot engine runs on `grammY` using Long Polling (`getUpdates`).

- Long Polling eliminates the need for inbound open ports or public SSL endpoints during development.
- When an incident triggers a status change to `DOWN` or `DEGRADED`, an alert card is formatted and sent to registered operator chats.
- Inline keyboard buttons allow operators to launch the Mini App triage cockpit or silence notifications directly from the chat.

### 4. Database Schema (`server/src/monitor/store.ts`)

The application uses an embedded SQLite database (`node:sqlite`). It manages four tables:

```sql
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
  latency_p95 REAL NOT NULL DEFAULT 0,
  last_check INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS latency_ticks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  latency_ms REAL NOT NULL,
  status_code INTEGER,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  started_at INTEGER NOT NULL,
  resolved_at INTEGER,
  error_details TEXT,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS runbook_executions (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  triggered_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
  output TEXT
);
```

### 5. Frontend Architecture (`web/src/`)

The frontend is a single-page React 19 application built with Vite and Tailwind CSS.

- **Theme Synchronization:** Binds to Telegram's `--tg-theme-bg-color`, `--tg-theme-text-color`, and related CSS custom properties. It automatically supports Telegram dark and light themes.
- **Haptic Feedback:** Interactive triggers call `WebApp.HapticFeedback.impactOccurred('medium')` or `notificationOccurred('success')` to give tactile confirmation during operations.
- **Server-Sent Events Listener:** The `useSSE` hook maintains an active connection to `/api/stream`, applying state updates to the React component tree without polling.
- **Simulator Mode:** If opened outside Telegram, the app wraps itself in a simulated Telegram mobile frame with custom user selector and dark mode toggle.
