# MCP Tools for Observability Engineering

This file maps observability domains (from the book) to MCP servers the user may have configured.
Claude Code reads this when it needs to know HOW to access live data for each observability task.

---

## Setup Status Check

Before using any MCP tool, verify it's configured:
```
claude mcp list
```

If a needed server isn't listed, provide the user with the setup instructions below.

---

## 1. Datadog MCP Server

**Official remote server** (Datadog's own, Claude Code native support)

### Setup:
```bash
claude mcp add --transport http datadog \
  "https://mcp.datadoghq.com/mcp/v1?toolsets=core,apm,alerting" \
  --header "DD-API-KEY: $DD_API_KEY" \
  --header "DD-APPLICATION-KEY: $DD_APP_KEY"
```

Or for full toolsets:
```bash
claude mcp add --transport http datadog \
  "https://mcp.datadoghq.com/mcp/v1?toolsets=all"
```

### What it can do:

**Logs**:
- `search_datadog_logs` — Query logs with filters (service, time range, status, tags)
- `analyze_datadog_logs` — Summarize or compare log patterns in a focused slice
- Prompt: "Get 5xx error logs for service `checkout` in the last 30 minutes"
- Prompt: "Show me logs for user_id=12345 across all services today"

**Metrics**:
- `search_datadog_metrics` — Discover relevant metrics by name or pattern
- `get_datadog_metric` — Query time-series data
- `get_datadog_metric_context` — Inspect tags and dimensions before grouping/filtering
- Prompt: "Show me error rate for the payment service over the last 2 hours"
- Prompt: "What's the p99 latency for `api.request.duration` by endpoint?"

**Traces (core + APM)**:
- `get_datadog_trace` — Retrieve a full trace by trace ID
- `search_datadog_spans` — Search spans with filters from the core toolset
- `apm_search_spans` / `apm_explore_trace` — Deeper APM analysis when the `apm` toolset is enabled
- Prompt: "Find the slowest traces for service `checkout` in the last hour"
- Prompt: "Get the full trace for trace_id=abc123 with all spans"

**Monitors**:
- `search_datadog_monitors` — List monitors with filters for status, tags, or names
- Prompt: "List all monitors currently in ALERT state"
- Prompt: "Show monitors tagged with team:payments"

**Incidents**:
- `search_datadog_incidents` — List active or recent incidents
- `get_datadog_incident` — Get details of a specific incident
- Prompt: "Are there any active incidents right now?"
- Prompt: "What incidents were declared in the last 24 hours?"

**Dashboards**:
- `search_datadog_dashboards` — List available dashboards
- Prompt: "Show me all dashboards related to the checkout service"

**Available toolsets**:
- `core`: logs, metrics, traces, dashboards, monitors, incidents, hosts, services, events, notebooks (default)
- `apm`: deep APM trace analysis, span search, Watchdog insights, performance investigation
- `alerting`: monitor validation, monitor group search, monitor templates
- `dbm`: Database Monitoring queries

---

## 2. Grafana MCP Server

**Official Grafana MCP** — covers Prometheus metrics, Loki logs, Tempo traces, and dashboards.

### Setup:
```bash
# Via uvx (Python)
claude mcp add grafana -- uvx mcp-grafana

# Set env vars
export GRAFANA_URL=http://localhost:3000
export GRAFANA_SERVICE_ACCOUNT_TOKEN=your_token_here
```

Or in `claude.json`:
```json
{
  "mcpServers": {
    "grafana": {
      "command": "uvx",
      "args": ["mcp-grafana"],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": "<token>"
      }
    }
  }
}
```

### What it can do:

**Prometheus metrics (PromQL)**:
- Execute instant PromQL queries
- Execute range queries with time windows
- Prompt: "Show me the HTTP error rate (5xx) for the checkout service over the last hour"
- Prompt: "What's the p99 latency of `http_request_duration_seconds` grouped by endpoint?"
- PromQL examples:
  ```
  rate(http_requests_total{status=~"5.."}[5m])
  histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
  sum by (service) (rate(errors_total[5m]))
  ```

**Loki logs (LogQL)**:
- Query log streams
- Prompt: "Search Loki for ERROR logs from the payment service in the last 30 minutes"
- LogQL examples:
  ```
  {service="checkout"} |= "error"
  {namespace="production"} | json | status >= 500
  rate({service="api"}[5m])
  ```

**Tempo traces**:
- Search distributed traces
- Prompt: "Find traces from service `checkout` with duration > 2 seconds"
- TraceQL examples:
  ```
  {.service.name="checkout" && duration > 2s}
  {status=error && .http.method="POST"}
  ```

**Dashboards**:
- List, search, and query dashboards
- Prompt: "Show me all dashboards tagged with 'production'"
- Prompt: "What panels are in the 'API Performance' dashboard?"

---

## 3. Prometheus MCP Server

**Direct Prometheus access** — for PromQL when not using Grafana.

### Setup options:

**Option A (community server)**:
```bash
claude mcp add prometheus -- uvx prometheus-mcp-server
export PROMETHEUS_URL=http://localhost:9090
```

**Option B (via npx)**:
```bash
claude mcp add prometheus -- npx @prom-mcp/prometheus-mcp-server
```

### What it can do:
- `query` — Instant PromQL query
- `query_range` — Range PromQL query with step
- `list_metrics` — Discover all available metrics
- `get_metadata` — Get help text and type for a metric
- `list_labels` — Get label names/values for metric exploration

**Key use cases for the Core Analysis Loop**:

Step 3 (isolate): `rate(http_requests_total[5m])` — is there a spike?
Step 4 (search dimensions):
```promql
# Slice error rate by AZ
sum by (availability_zone) (rate(errors_total{status=~"5.."}[5m]))

# Slice by endpoint
sum by (endpoint) (rate(http_requests_total{status="500"}[5m]))

# Slice by host
sum by (instance) (rate(errors_total[5m]))
```

---

## 4. GitHub MCP Server

**Deploy correlation** — the book emphasizes correlating anomalies with deployments.

### Setup:
```bash
claude mcp add github -- npx @modelcontextprotocol/server-github
export GITHUB_PERSONAL_ACCESS_TOKEN=your_token
```

### Key use cases:
- "What was deployed to production in the last 2 hours?"
  → Use the server's commit-listing capability on the main/production branch
- "What changed between SHA abc123 and def456?"
  → Use commit comparison between the two SHAs
- "Who merged the last 5 PRs to main?"
  → Use PR listing/search filtered to merged pull requests

**Why this matters (from the book)**: Feature deployments introduce anomalies. When investigating a spike, always check if a deploy happened at the same time. The `deploy_sha` field in your wide events + GitHub MCP = instant correlation.

---

## 5. OpenTelemetry Collector (no MCP — configure in code)

The OTel Collector is not queried via MCP — it's infrastructure you configure.

**Recommended `otel-collector-config.yaml` for a standard OTel stack**:
```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
  memory_limiter:
    limit_mib: 512
  # Strip PII
  attributes:
    actions:
      - key: user.email
        action: delete

exporters:
  otlp/datadog:
    endpoint: https://trace.agent.datadoghq.com
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/datadog]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, attributes, batch]
      exporters: [loki]
```

---

## Domain → MCP Tool Mapping

| Observability task | Preferred MCP | Fallback |
|---|---|---|
| Query live logs | Datadog: `search_datadog_logs` | Grafana: Loki |
| Query metrics / PromQL | Grafana: Prometheus | Prometheus MCP |
| Get full trace by ID | Datadog: `get_datadog_trace` | Grafana: Tempo |
| Find slow traces | Datadog: `search_datadog_spans` or `apm_search_spans` | Grafana: Tempo |
| Check active alerts/monitors | Datadog: `search_datadog_monitors` | Grafana: alerting |
| Check active incidents | Datadog: `search_datadog_incidents` | — |
| Correlate with deploys | GitHub MCP | — |
| Explore available metrics | Prometheus: `list_metrics` | Datadog: `search_datadog_metrics` / `get_datadog_metric_context` |
| View dashboards | Grafana: list dashboards | Datadog: `search_datadog_dashboards` |
| APM: service map, dependencies | Datadog APM toolset | — |
| Database query performance | Datadog DBM toolset | — |

---

## Workflow: Core Analysis Loop Executed with MCPs

When running the Core Analysis Loop (SKILL.md §5), map each step to MCP calls:

```
Step 1 — Start with the symptom:
  → "List active Datadog monitors in ALERT state"
  → "Are there open incidents in the last hour?"

Step 2 — Verify the anomaly:
  → "Show error rate for [service] over last 30 min" (Prometheus/Grafana or Datadog)
  → Look for a step change in the curve

Step 3 — Isolate scope:
  → "Show error rate broken down by service" (PromQL: sum by service)
  → Narrow time range to when the change started

Step 4 — Search for distinguishing dimensions:
  → "Get sample logs for 500 errors in [service], last 30 min"
  → "Slice error rate by availability_zone / host / endpoint"
  → Look for dimensions where the anomalous group >> baseline

Step 5 — Validate hypothesis:
  → "Filter logs to az=us-east-1a and show error rate"
  → "Find traces where host=i-0abc123 and status=500"

Step 6 — Correlate with deploys:
  → "What commits were merged to main in the last 2 hours?" (GitHub MCP)

Step 7 — Document findings:
  → Note the distinguishing dimensions
  → "What instrumentation was missing that made this harder to find?"
```
