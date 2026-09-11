# Sentinel Pocket API Reference

Sentinel Pocket exposes REST endpoints for data retrieval and remediation, along with an SSE endpoint for live telemetry.

## Authentication

All `/api/*` endpoints require the `Authorization` header when running in production (`MOCK_MODE=false`):

```http
Authorization: tma <raw_init_data_string>
```

In mock mode (`MOCK_MODE=true`), requests without headers or with `Authorization: tma mock` are accepted.

---

## Endpoints

### 1. List Services

```http
GET /api/services
```

Returns the current health status, last check timestamp, and recent latency data points for all registered services.

**Response (`200 OK`):**
```json
[
  {
    "id": "srv_payments",
    "name": "Payment Gateway API",
    "url": "https://payments.internal.net/health",
    "status": "HEALTHY",
    "latencyP95": 142.5,
    "lastCheck": 1741738200000,
    "recentLatencies": [
      { "timestamp": 1741738140000, "latencyMs": 120.4, "statusCode": 200 },
      { "timestamp": 1741738170000, "latencyMs": 138.1, "statusCode": 200 },
      { "timestamp": 1741738200000, "latencyMs": 142.5, "statusCode": 200 }
    ]
  }
]
```

---

### 2. List Incidents

```http
GET /api/incidents
```

Returns unresolved and recent incidents.

**Query Parameters:**
- `status`: Filter by `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, or `ALL` (default: `OPEN`).

**Response (`200 OK`):**
```json
[
  {
    "id": "inc_98231",
    "serviceId": "srv_payments",
    "title": "HTTP 504 Gateway Timeout",
    "status": "OPEN",
    "severity": "CRITICAL",
    "startedAt": 1741738150000,
    "resolvedAt": null,
    "errorDetails": "Downstream payment processor failed to respond within 2500ms."
  }
]
```

---

### 3. Acknowledge Incident

```http
POST /api/incidents/:id/ack
```

Marks an active incident as acknowledged.

**Request Body:**
```json
{
  "acknowledgedBy": "alexandrmotologa"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "incidentId": "inc_98231",
  "status": "ACKNOWLEDGED"
}
```

---

### 4. Trigger Runbook Action

```http
POST /api/runbook/trigger
```

Executes a remediation action for a service.

**Request Body:**
```json
{
  "runbookId": "restart_container",
  "serviceId": "srv_payments",
  "reason": "Resolving connection pool saturation"
}
```

**Supported `runbookId` values:**
- `restart_container`: Signals container orchestrator to restart instance.
- `rollback_canary`: Invokes `canarymesh` to revert to baseline version.
- `flush_cache`: Clears cache keys.
- `silence_1h`: Suppresses notifications for 60 minutes.
- `silence_24h`: Suppresses notifications for 24 hours.

**Response (`200 OK`):**
```json
{
  "success": true,
  "executionId": "exec_54219",
  "runbookId": "restart_container",
  "serviceId": "srv_payments",
  "status": "SUCCESS",
  "output": "Service container restarted successfully. Health checks verified."
}
```

---

### 5. Runbook Execution History

```http
GET /api/runbook/history
```

Returns recent runbook executions from SQLite.

**Response (`200 OK`):**
```json
[
  {
    "id": "exec_54219",
    "runbookId": "restart_container",
    "serviceId": "srv_payments",
    "triggeredBy": "alexandrmotologa",
    "triggeredAt": 1741738220000,
    "status": "SUCCESS",
    "output": "Service container restarted successfully. Health checks verified."
  }
]
```

---

### 6. Live Telemetry Stream (SSE)

```http
GET /api/stream
```

Opens a persistent Server-Sent Events stream. The server sends periodic latency ticks and incident broadcasts.

**Connection Headers:**
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Stream Payloads:**

*Heartbeat (every 15 seconds):*
```
: keep-alive
```

*Latency Tick Event:*
```
event: tick
data: {"serviceId":"srv_payments","timestamp":1741738230000,"latencyMs":132.8,"statusCode":200}
```

*Incident Update Event:*
```
event: incident
data: {"type":"CREATED","incident":{"id":"inc_98231","serviceId":"srv_payments","title":"HTTP 504 Gateway Timeout","status":"OPEN","severity":"CRITICAL","startedAt":1741738150000}}
```
