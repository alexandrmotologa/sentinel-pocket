# Sentinel Pocket Remediation Runbooks

This guide details the remediation workflows executable through Sentinel Pocket.

## Available Runbooks

### 1. Restart Container (`restart_container`)

- **Purpose:** Restarts the container instances of a degraded or unresponsive service.
- **When to Use:**
  - Memory leak or uncollected thread accumulation.
  - Connection pool exhaustion to upstream databases.
  - Unresponsive HTTP event loop.
- **Ecosystem Execution:** Sends a restart command to Docker or the Kubernetes pod manager.

---

### 2. Rollback Canary Deployment (`rollback_canary`)

- **Purpose:** Immediately drops traffic to a canary deployment and routes 100% of ingress to the stable baseline deployment.
- **When to Use:**
  - `canarymesh` reports an error rate deviation > 2% on canary pods.
  - Latency p95 spikes immediately following a new release.
- **Ecosystem Execution:** Dispatches a rollback command to the `canarymesh` API endpoint (`CANARYMESH_ENDPOINT`).

---

### 3. Flush Cache (`flush_cache`)

- **Purpose:** Purges in-memory keys or Redis cache layers.
- **When to Use:**
  - Cache poisoning or schema mismatch after a configuration release.
  - Stale read replicas returning outdated state.
- **Ecosystem Execution:** Connects to Redis / Memcached and executes namespace eviction.

---

### 4. Silence Alerts (`silence_1h` / `silence_24h`)

- **Purpose:** Temporarily stops alert notifications for a known incident during active investigation.
- **When to Use:**
  - Engineering team is actively working on the root cause.
  - Scheduled maintenance or network upgrade window.
- **Ecosystem Execution:** Marks the service's silence expiration in SQLite.

---

## Audit Trail

Every runbook execution records:
1. `execution_id`: Unique identifier.
2. `service_id`: Target service.
3. `triggered_by`: Authenticated Telegram user handle or user ID.
4. `triggered_at`: UTC timestamp.
5. `status`: `SUCCESS`, `FAILED`, or `PENDING`.
6. `output`: Diagnostic stdout/stderr or API response from the target system.
