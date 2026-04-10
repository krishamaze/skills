---
name: observability-engineering
description: >
  Deep observability engineering knowledge from "Observability Engineering" (Majors, Fong-Jones, Miranda).
  Read this skill whenever Claude Code is asked to: instrument code for observability, debug production
  issues, set up or query monitoring/tracing/logging tools, configure SLOs or alerts, design telemetry
  pipelines, review instrumentation quality, or investigate incidents. Also triggers on keywords:
  observability, o11y, tracing, spans, cardinality, SLO, SLI, error budget, structured events,
  OpenTelemetry, OTel, sampling, telemetry pipeline, BubbleUp, core analysis loop, wide events,
  MELT (metrics/events/logs/traces), Honeycomb, Datadog, Grafana, Prometheus, Loki, Tempo, Jaeger.
  This skill is the WHAT (book wisdom) that pairs with MCP tools as the HOW (live data access).
  Always read this before writing instrumentation code, querying observability backends, or advising
  on monitoring strategy — even if the user doesn't explicitly mention "observability."
---

# Observability Engineering Skill

Source: *Observability Engineering* — Charity Majors, Liz Fong-Jones, George Miranda (O'Reilly, 2022)

This skill encodes the book's core wisdom so Claude Code can act as an observability-aware engineer:
knowing **what to look for** (from the book) and **how to look** (via MCP tools connected by the user).

---

## 1. Core Philosophy: Observability vs Monitoring

**The fundamental definition**: Observability is a measure of how well you can understand and explain *any* state your system can get into, no matter how novel or bizarre — *without needing to predict that state in advance*.

**Litmus test — you have observability if**:
- You can answer open-ended questions about internal workings without hitting investigative dead ends
- You can understand what *any particular user* is experiencing at *any given time*
- You can see any cross-section of system performance — from aggregate to single request
- You can isolate any fault within minutes, no matter how deep in the stack
- Your debugging investigations often *surprise you* with novel findings (not just confirming suspicions)

**Monitoring ≠ Observability**:
| Monitoring | Observability |
|---|---|
| Approximates health in broad brushstrokes | Painstakingly maps state space in granular detail |
| Alerts on *known* failure modes | Surfaces *unknown-unknowns* |
| Pre-aggregated, lossy | Raw, high-fidelity events |
| Reactive (threshold exceeded) | Exploratory (iterative questioning) |
| Dashboard → intuition → guess | Hypothesis → evidence → next question |

**Key insight**: Traditional monitoring requires you to *know the question in advance*. Observability lets you ask questions you didn't know you'd need to ask.

**Both are needed**: Monitoring for known failure modes + SLO alerting; observability for novel debugging.

---

## 2. Data Model: The Arbitrarily Wide Structured Event

**The fundamental unit**: An *event* = a record of everything that occurred while one particular request interacted with your service. Stored as a structured map (JSON), emitted once per request lifecycle.

**"Arbitrarily wide"** means: no practical limit on the number of fields. Mature instrumentation produces **300–400 dimensions per event**.

### What to put in a wide event:
```
request context:  user_id, session_id, tenant_id, feature_flags, client_version
request details:  endpoint, method, path, query_params, payload_size
execution:        duration_ms, db_queries_count, cache_hits, cache_misses
infrastructure:   host, az, region, pod_name, container_id, deploy_sha
dependencies:     downstream_service, downstream_latency, downstream_status
outcome:          status_code, error_type, error_message, retry_count
business context: plan_tier, customer_segment, experiment_group
trace:            trace_id, span_id, parent_span_id
```

### Two critical properties of useful events:

**Cardinality**: The number of unique values a field can have.
- *High cardinality* = `user_id`, `trace_id`, `session_id` — essential for debugging individual experiences
- *Low cardinality* = `status_code`, `region`, `method` — useful for grouping
- **Metrics TSDBs cannot handle high cardinality** — this is why wide events + observability tooling is necessary

**Dimensionality**: The number of fields in your events.
- More dimensions = more angles to slice data from
- You can't retroactively add dimensions you didn't capture — instrument generously upfront

### Why not metrics? Why not logs?

**Metrics (TSDBs) limitations**:
- Pre-aggregated at write time — information is permanently lost
- Fixed schema — you must predict what you'll query
- Cannot handle high cardinality (cardinality explosion)
- Good for: known aggregate views, infrastructure metrics, dashboards

**Unstructured logs limitations**:
- Hard to parse and aggregate at query time
- Expensive to index across all fields
- No native correlation between log lines for one request

**Structured logs** (logs as structured events) are better, but individual log lines don't capture the full request lifecycle the way a wide event does. **Roll up multiple log lines into one wide event per request.**

---

## 3. Traces: Stitching Events Across Services

**A distributed trace** = a correlated series of wide events (spans) that together represent one request's journey across multiple services.

### Five required fields per span:
1. `trace_id` — unique identifier for the entire request journey
2. `span_id` — identifier for this specific unit of work
3. `parent_span_id` — which span spawned this one (enables tree reconstruction)
4. `start_time` — when this span began
5. `duration` — how long it took

### Propagation:
- Pass `trace_id` + `span_id` (as new `parent_span_id`) via HTTP headers downstream
- W3C TraceContext header (`traceparent`) is the standard
- Every service in the call chain creates its own span, linking back to the parent

### Visualization:
- **Waterfall view**: Shows parent-child relationships + timing at a glance
- Critical path analysis: Which span added latency? Which is the bottleneck?

### Custom fields on spans:
Add business context beyond the auto-instrumented skeleton:
- `user_id`, `shard_id`, `tenant_id`, `experiment_group`
- Error details, retry counts, queue depths
- Any field that would help explain *why* this span was slow or failed

---

## 4. OpenTelemetry (OTel) — The Standard Instrumentation Layer

**What OTel is**: The vendor-neutral open standard for application instrumentation. Instrument once, send to any backend.

### OTel components:
- **API**: Language-agnostic interfaces for creating spans and metrics
- **SDK**: Concrete implementation that tracks state and batches data
- **Tracer**: Tracks active span, allows adding attributes and finishing spans
- **Meter**: Tracks metric instruments (counters, gauges, histograms)
- **Context propagation**: Deserializes trace context from inbound headers (W3C TraceContext, B3)
- **Exporter**: Sends telemetry to a backend (OTLP gRPC/HTTP, Jaeger, Prometheus, etc.)
- **Collector**: A pipeline component that receives, processes, and re-exports telemetry

### Auto-instrumentation vs custom:
1. **Start with auto-instrumentation**: Gets you spans for HTTP, gRPC, database calls with zero code changes. This is your skeleton.
2. **Add custom spans**: For expensive internal operations not covered by auto-instrumentation
3. **Add wide fields**: Attach business context to auto-instrumented spans — this is where the real value is

### Code pattern (Go example):
```go
// Start a custom child span
ctx, span := otel.Tracer("myservice").Start(ctx, "operation-name")
defer span.End()

// Add wide fields
span.SetAttributes(
    attribute.String("user.id", userID),
    attribute.String("tenant.id", tenantID),
    attribute.Int("db.query_count", queryCount),
    attribute.String("feature.flag", flagValue),
)
```

### Export: always use OTLP
- OTLP gRPC to an OTel Collector (recommended) or directly to your vendor
- The Collector lets you route, filter, sample, and fan-out to multiple backends without code changes

---

## 5. The Core Analysis Loop — How to Debug with Observability

**This is the methodology**. Apply it every time you investigate a production issue.

```
1. START with the symptom
   → What did the alert or user report tell you?
   → What is the user-visible impact?

2. VERIFY something is wrong
   → Is there a measurable change in performance?
   → Look at heatmaps/histograms of request latency or error rate

3. ISOLATE the scope
   → Time range: When did it start? Is it ongoing?
   → Service scope: All services or one?

4. SEARCH for the distinguishing dimension
   → Sample raw events from the anomalous window
   → Slice across various dimensions looking for patterns:
       - Which user segments? (user_id, tenant_id, plan_tier)
       - Which infrastructure? (az, host, container, pod)
       - Which code path? (endpoint, feature_flag, version)
       - Which dependency? (downstream_service, db_shard)
   → Look for dimensions where the anomalous population differs
     dramatically from baseline

5. VALIDATE the hypothesis
   → Does filtering on that dimension reproduce the anomaly?
   → Does the complement (excluding that dimension) look normal?

6. DRILL DOWN or PIVOT
   → If validated: go deeper into that dimension
   → If not: return to step 4 with a different dimension

7. RESOLVE and RECORD
   → Document the distinguishing dimensions found
   → Add instrumentation to catch this faster next time
```

**BubbleUp (Honeycomb's automation of step 4)**:
- Select the anomalous area in a heatmap
- BubbleUp computes % presence of each dimension value in anomalous vs baseline events
- Surfaces the top differentiating dimensions automatically
- Equivalent: ask your observability tool to compare anomalous vs normal slices

**Key principle**: Debug from first principles, not from intuition. Don't guess and look for confirmation. Start with the symptom, form a hypothesis, validate or invalidate it.

---

## 6. SLOs — Reliability Alerting Done Right

### Definitions:
- **SLI** (Service Level Indicator): A measure categorizing each request as good or bad
  - Request-based: `good_requests / total_requests`
  - Time-based: `time_with_p99_latency < 300ms / total_time`
- **SLO** (Service Level Objective): The target percentage (e.g., 99.9%)
- **Error budget**: `1 - SLO_target` expressed as allowed failures (e.g., 43.8 min/month for 99.9%)

### Why SLOs beat threshold alerts:
- Threshold alerts (CPU > 80%, memory > 90%) = potential-cause alerts → massive false positive rate
- SLOs alert on *user impact* — the "what" is broken, not guessing at "why"
- SLOs decouple detection from diagnosis: alert fires → then use observability to find the why

### Good alert criteria (from Google SRE):
1. Must reflect **urgent user impact** (not system internals)
2. Must be **actionable** (you know what to do when it fires)
3. Must be **novel** (not "this always fires during peak")
4. Must require **investigation**, not rote action

### Burn rate alerting:
- Track error budget consumption rate over a sliding window
- Alert when burn rate predicts budget exhaustion before month end
- **Lookahead window**: How far ahead to forecast (e.g., 1 hour, 6 hours, 1 day)
- **Baseline window**: How much recent history to use in the model
- Preemptive alerts let you fix the biggest error sources before you're out of budget

### SLOs with observability data (event-based SLIs):
- More precise than time-series metrics — counts actual requests, not inferred rates
- Debuggable: when SLO fires, you already have the request-level data to debug with
- Warning: SLO implementations using only metrics lose the debugging context

### Error budget policy:
- Budget full → ship features fast
- Budget 50% spent → review reliability investments
- Budget nearly exhausted → freeze features, all hands on reliability
- SLOs reset on rolling windows (30d), not calendar month (avoids cliff resets)

---

## 7. Sampling — Managing Data Volume at Scale

**When to sample**: When 100% event capture is cost-prohibitive. Most successful events are nearly identical — sampling preserves signal while reducing volume.

**Key rule**: Always record the sample rate in the event so the backend can reconstruct accurate statistics.

### Sampling strategies (in order of sophistication):

**1. Constant-probability (head-based)**:
- Sample 1 in N requests, randomly
- Simple, but misses rare long-tail events (errors, high-latency outliers)
- Good for: well-understood, homogeneous traffic

**2. Volume-adjusted (dynamic rate)**:
- Increase rate when traffic is low, decrease when traffic is high
- Requires weighted reconstruction at query time
- Good for: variable traffic loads

**3. Per-key (content-based)**:
- Sample based on event content (e.g., HTTP method, status code, error type)
- Different sample rates for different "keys" — errors at 100%, 200s at 1%
- Good for: preserving rare-but-important events

**4. Tail-based sampling**:
- Sample decision made *after* the full trace completes
- Can guarantee all error traces are sampled
- Requires buffering spans until the trace closes (more complex)
- Good for: high-volume services where you must preserve all failures

**5. Combined head + tail per key**:
- Head-based decision propagated downstream (consistent sampling)
- Tail-based override for outliers (errors, slow traces)
- Most powerful; most complex to implement

**Consistent sampling for traces**:
- The head-sampling decision must be propagated in trace context (typically `traceparent` plus any vendor or OTel data in `tracestate`), not in an ad hoc custom header
- All spans in a trace must be sampled/dropped together
- Use a hash of the trace ID (not random) to make the decision consistent across services

---

## 8. Telemetry Pipeline Architecture

**What a telemetry pipeline does**: Receives, processes, routes, and exports telemetry between your services and your observability backends — *without code changes when backends change*.

### Core pipeline capabilities:
- **Routing**: Send traces to tracing backend, logs to logging backend, fan-out the same stream to multiple sinks
- **Security/compliance**: Strip PII fields before export, enforce data residency
- **Workload isolation**: Separate high-priority telemetry (errors, user-facing) from bulk telemetry
- **Buffering**: Local disk or Kafka queue to survive backend outages without data loss
- **Capacity management**: Soft/hard rate limits with progressive sampling under load
- **Filtering/augmentation**: Drop noisy events, enrich events with metadata
- **Data transformation**: Convert formats (e.g., logs → structured events)

### OTel Collector architecture:
```
Application → [OTLP] → OTel Collector → Processor chain → Exporter(s)
                                ↓
                         Receivers: OTLP, Prometheus, Jaeger, Fluentd
                         Processors: batch, memory_limiter, filter, attribute, sampling
                         Exporters: OTLP, Datadog, Honeycomb, Prometheus, Loki
```

### Slack's telemetry pipeline pattern (production at millions of events/sec):
- Kafka as the central message queue (durable, ordered, replayable)
- Stateless receiver processes validate and produce to Kafka
- Stateful workers consume from Kafka, index and route to backends
- Separate pipelines for metrics vs logs/traces

### Key reliability concerns for pipelines:
- **Performance**: Pipeline must not become a bottleneck; keep it stateless where possible
- **Correctness**: Transformation bugs silently corrupt your observability data
- **Availability**: If the pipeline is down, you're blind; use buffering
- **Data freshness**: Stale data causes false conclusions; prioritize recent data
- **Isolation**: One team's telemetry storm shouldn't starve another's

---

## 9. Observability Maturity Model (OMM)

Five capability areas to benchmark and prioritize investment:

### Capability 1: Respond to System Failure with Resilience
- **Weak**: Reactive — find out about failures from users or after the fact
- **Strong**: Proactive — SLO burn alerts fire before users report issues; MTTR < 10 min

### Capability 2: Deliver High-Quality Code
- **Weak**: Production is a "glass castle" — roll back at first sign of trouble
- **Strong**: Observability-driven development; instrument before shipping; verify in prod with confidence

### Capability 3: Manage Complexity and Technical Debt
- **Weak**: Senior engineers are the "heroes" with mental runbooks; knowledge is tribal
- **Strong**: Any engineer can debug any service using the core analysis loop; runbooks are supplemental

### Capability 4: Release on a Predictable Cadence
- **Weak**: Releases are risky, infrequent, require extensive pre-production testing
- **Strong**: Continuous deployment with feature flags + observability to safely roll out and verify

### Capability 5: Understand User Behavior
- **Weak**: User experience inferred from aggregate metrics; individual user experience unknowable
- **Strong**: Can answer "what is user X experiencing right now" within seconds

**Using the OMM**: Assess where you are, identify the capability with the highest business impact to improve, invest there. Repeat. There is no "done."

---

## 10. MCP Tools: How to Access Live Data

These are the MCP servers the user may have connected. Each maps to what you know to look for.

> Read `references/mcp-tools.md` for full setup details, tool names, and example prompts per backend.

### Quick reference:

| What you need | MCP Server | Key capability |
|---|---|---|
| Logs, metrics, traces, monitors, incidents | **Datadog MCP** | Full MELT + APM + incident management |
| PromQL queries, Loki logs, Tempo traces, dashboards | **Grafana MCP** (`mcp-grafana`) | Open-source observability stack |
| PromQL metric queries | **Prometheus MCP** | Direct metric exploration |
| Deploy correlation | **GitHub MCP** | Correlate SHAs with production incidents |

### How to use MCP tools with this book's methodology:

**Core Analysis Loop via MCP**:
1. Start: "List active monitors/alerts" → Datadog: `search_datadog_monitors`, Grafana: check dashboards
2. Verify: "Show request error rate for [service] over last 30 min" → PromQL or Datadog metrics
3. Isolate: "Get logs for [service] filtered to 5xx errors, last 30 min" → `search_datadog_logs`
4. Search: "Get traces for the slowest 5% of requests" → Datadog `search_datadog_spans` / `apm_search_spans` or Tempo
5. Drill: "Slice error logs by `user_id`, `az`, `host`" → filter and group in your query

**SLO debugging via MCP**:
- "Show me which requests are burning the error budget" → Datadog monitors + APM
- "Get traces for requests that returned 5xx" → trace search filtered by status

**Instrumentation audit via MCP**:
- Query a sample of recent events → check field richness (is `user_id` present? `trace_id`?)
- If fields are missing: that's a gap to fix in instrumentation

---

## Quick Decision Guide

**When investigating an incident**:
→ Start with the Core Analysis Loop (Section 5), use MCP tools to execute each step

**When writing new instrumentation**:
→ Wide events (Section 2): capture user context + infrastructure + business dimensions
→ OTel (Section 4): use auto-instrumentation + add custom spans + wide fields

**When setting up alerts**:
→ SLOs not thresholds (Section 6): alert on user impact, not system internals

**When data volume is too high**:
→ Sampling (Section 7): start with per-key, prioritize errors at 100%

**When routing telemetry to multiple backends**:
→ Telemetry pipeline (Section 8): OTel Collector → Kafka-backed pipeline at scale

**When measuring progress**:
→ Observability Maturity Model (Section 9): assess 5 capabilities, invest in highest-impact gap
