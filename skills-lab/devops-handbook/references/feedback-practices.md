# Feedback Practices: Telemetry, Monitoring, Hypothesis-Driven Development

Source: Part IV (Ch. 14–18), The DevOps Handbook 2nd Ed.

---

## Telemetry (Ch. 14)

### The Core Principle
You cannot protect what you cannot see. Every service must emit telemetry — events, logs, and metrics — that flow into a central observability system.

### Monitoring Framework (Figure 14.2)
Layers from infrastructure to business:
1. **Infrastructure** — CPU, memory, disk, network
2. **Application** — request rates, error rates, latency
3. **Business metrics** — orders, signups, revenue events
4. **User experience** — page load times, conversion rates

All four layers matter. Infrastructure health doesn't tell you if the business is working.

### Case Study: DevOps Transformation at Etsy (2012)
Etsy instrumented everything. Their key innovation: one line of code using StatsD and Graphite generates telemetry for any event (Figure 14.3). When deployments went out, engineers could watch real-time graphs for signs of trouble. If PHP run-time warnings spiked after a deploy, it was immediately visible and fixable (Figure 16.1). Etsy also detected SQL injection attempts in real-time via Graphite — telemetry doubling as security monitoring (Figure 22.5).

### Case Study: Creating Self-Service Metrics at LinkedIn (2011)
LinkedIn built a self-service metrics platform — any engineer could instrument their service without requesting a dashboard from a central team. Democratized observability.

### Information Radiators
Large displays in team spaces showing production health in real-time. Psychological benefit: the team's relationship with production changes when they're constantly watching it.

---

## Anomaly Detection & Alerting (Ch. 15)

### The Problem with Simple Thresholds
Static thresholds ("alert when CPU > 80%") produce too many false positives or miss real problems. Production traffic is not Gaussian — it has seasonality, trends, and patterns.

### Better Approaches
- **Moving averages** — smooth out noise, reveal trends (Autodesk example, Figure 15.6)
- **Kolmogorov-Smirnov test** — statistical test for distribution change (Figure 15.8) — detects anomalies that threshold-based alerting misses
- **Prediction-based alerting** — forecast expected load, alert on deviation from forecast

### Case Study: Netflix Scryer (2012)
Netflix built Scryer to forecast customer demand (Figure 15.5) and pre-provision AWS resources accordingly. They moved from reactive scaling to predictive scaling. Viewing demand data drove AWS scheduling (Figure 15.4).

### Case Study: Auto-Scaling at Netflix (2012)
Netflix auto-scaled based on predicted demand rather than current demand. This eliminated both under-provisioning (incidents) and over-provisioning (cost waste).

### Alert fatigue is a First Way problem
Too many alerts → engineers ignore them → real incidents are missed. The goal is meaningful, actionable alerts, not comprehensive ones.

---

## Deployment Feedback Loops (Ch. 16)

### Peer Review and Code Review (Ch. 18)

**GitHub Pull Request model (Figure 18.1):** All changes reviewed before merge. Comments, suggestions, and approvals are visible to the whole team.

**Case Study: Peer Review at GitHub (2011):** GitHub's own engineering team pioneered the pull request model. Everyone reviews; quality and knowledge sharing improve.

**Code Review at Google (2010):** Every change requires at least one approval from someone who knows the codebase. Google data (Figure 18.2): review lead time increases dramatically as diff size grows. Small, focused PRs are faster and better reviewed.

**Case Study: Adidas (2020):** Moved from a "six-eye principle" (three approvers required) to a scaled release process supporting multiple deploys per day. Compliance requirements preserved through automation, not manual gates.

**Case Study: Pair Programming at Pivotal Labs (2011):** Pair programming as an alternative to async code review. Defects caught in real-time, knowledge transfer continuous.

### Production Readiness Reviews (Google, Ch. 16)
Before a service goes live, run through: Is monitoring in place? Is deployment automated? Are runbooks written? Is rollback tested? Has load testing been done?

Google's Launch Readiness Review (LRR) and Handoff Readiness Review (HRR) — structured checklists ensuring services are operationally ready before they go live (Figure 16.3).

---

## Hypothesis-Driven Development & A/B Testing (Ch. 17)

### Core Shift
Traditional: "We think users want X, so we'll build X."
Hypothesis-driven: "We hypothesize that X will increase Y metric by Z%. We'll ship a small experiment, measure, and decide."

This is a Second Way feedback loop applied to product decisions.

### Case Study: Intuit (2012)
Intuit embedded hypothesis-driven development into their product process. Every feature started with a hypothesis and a measurable outcome. If the outcome wasn't achieved, the feature was killed or pivoted. Dramatically reduced wasted engineering effort.

### Case Study: Yahoo! Answers (2010)
Yahoo! ran A/B experiments on release cycle length. Faster release cycles (weekly vs. monthly) produced 2x more validated learning per quarter, translating directly into revenue growth. The experiment proved that speed of iteration was more valuable than stability of releases.

### Key principle
You cannot learn what customers value without shipping to real customers. Long release cycles starve the feedback loop. Frequent small releases with measurement = learning at scale.
