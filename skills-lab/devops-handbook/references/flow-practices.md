# Flow Practices: Deployment Pipeline, CI, Testing, Release Patterns

Source: Part III (Ch. 09–13), The DevOps Handbook 2nd Ed.

---

## The Deployment Pipeline (Ch. 09–10)

The deployment pipeline is the core mechanism of the First Way. Every code commit runs through a gauntlet of automated stages that either approve or reject it before it reaches production.

### Pipeline Stages (Figure 10.1)
1. **Commit stage (automated):** Unit tests, static analysis, compile. Fast — under 10 minutes.
2. **Acceptance stage (automated):** Integration tests, acceptance tests. Slower but automated.
3. **Exploratory testing (manual):** Human-driven testing of edge cases, UX, exploratory scenarios.
4. **UAT (manual):** User acceptance testing.
5. **Staging:** Production-like environment validation.
6. **Production deploy.**

Automatic approval gates between automated stages. Manual approval gates only where human judgment is genuinely required.

### Total cycle time target: 25 minutes for commit → production-ready (Figure 1.3)

### Case Study: Enterprise Data Warehouse (2009)
Demonstrated that even data warehouse pipelines — traditionally the hardest to automate — can be brought into a deployment pipeline. The key was treating schema changes as code.

### Case Study: Hotel company running $30B revenue in containers (2020)
Migrated a massive hospitality platform into containerized infrastructure. Deployment pipeline handled the complexity; the business ran on containers without incident disruption.

---

## The Testing Pyramid (Ch. 10)

### Ideal vs. Non-Ideal (Figure 10.2)

**Ideal (bottom-heavy):**
- Many automated unit tests (fast, cheap, precise)
- Fewer automated component/integration tests
- Fewer automated API tests
- Very few automated GUI tests
- Minimal manual testing

**Non-Ideal (top-heavy / inverted pyramid):**
- Many manual tests
- Many GUI tests
- Few unit tests
This is slow, expensive, fragile, and a First Way anti-pattern.

### Key principle: Run tests in parallel, not in sequence (Figure 10.3)
Acceptance, capacity, and exploratory testing can run in parallel after the commit stage passes.

### Case Study: Google Web Server (2005)
Google built automated testing infrastructure at scale, enabling engineers to make changes to a massive codebase with confidence. The investment in automated testing infrastructure was foundational to their deployment velocity.

---

## Continuous Integration (Ch. 11)

### What CI Actually Means
CI is not a tool. CI is the practice of every developer integrating their work into the mainline (trunk) at least once per day, with automated tests running on every commit.

### Trunk-Based Development
- All developers commit to a single shared trunk/main branch
- Feature branches are short-lived (hours to days, not weeks)
- Long-lived branches are a CI anti-pattern — they create "merge hell"
- Feature flags (dark launches) allow incomplete features to exist in trunk without being activated

### Case Study: HP LaserJet Firmware (2006)
HP's firmware division had a massive monorepo and extremely painful integration cycles. By adopting trunk-based development and CI, they reduced integration time from weeks to hours and reclaimed 20,000 developer-hours per year.

### Case Study: Bazaarvoice (2012)
Bazaarvoice adopted trunk-based development after struggling with long-lived feature branches. Integration cycles dropped dramatically.

---

## Release Patterns (Ch. 12)

### Blue-Green Deployment (Figure 12.5)
Two identical production environments (Blue and Green). Traffic routes to one while the other receives the new release. On success, flip the router. On failure, flip back instantly.
- **Key benefit:** Zero-downtime deployments. Instant rollback.
- **Case Study:** Dixons Retail point-of-sale system (2008) — retail can't afford downtime.

### Canary Releases (Figure 12.6)
Deploy new release to a small subset of users/servers first. Monitor telemetry. If healthy, gradually expand. If unhealthy, roll back.
- **Case Study:** Facebook Chat (2008) — dark launched to employees first, then small % of users, expanding as confidence grew.

### Feature Flags (Dark Launches)
Deploy code to production but gate it behind a flag. Activate for internal users first, then segments, then everyone. Decouples deployment from release.

### Self-Service Deployment
- **Case Study: Etsy (2014):** The Deployinator console — any engineer could deploy to production with a button click. Visible, auditable, fast. Etsy went from weekly deploys to 25+ deploys per day.
- **Case Study: CSG International (2013):** Daily deployments reduced production incidents by 90% over 2 years (Figure 12.2). Counter-intuitive but well-documented: more frequent small deploys = fewer incidents.

### DORA Performance Benchmarks (Figure 12.3, 2019)
| Tier | Deploy Frequency | Lead Time | MTTR | Change Fail Rate |
|------|-----------------|-----------|------|-----------------|
| Elite | On-demand (multiple/day) | <1 hour | <1 hour | 0–15% |
| High | 1/day–1/week | 1 day–1 week | <1 day | 0–15% |
| Medium | 1/week–1/month | 1 week–1 month | 1 day–1 week | 0–15% |
| Low | 1/month–6 months | 1 month–6 months | 1 week–6 months | 46–60% |

---

## Architecture for Low-Risk Releases (Ch. 13)

### Architectural Archetypes (Table 13.1)
| Type | Pros | Cons |
|------|------|------|
| Monolith v1 | Simple start, single deploy | Grows coupling, slow builds, all-or-nothing deploy |
| Monolith v2 (n-tier) | Easy joins, single schema | Poor scaling, all-or-nothing |
| Microservices | Independent deploy/scale/test | Complex, requires sophisticated tooling, network latency |

The book doesn't mandate microservices. It mandates **loosely coupled architecture** — however you achieve it.

### Strangler Fig Pattern
Incrementally migrate a monolith by building new capabilities as independent services that "strangle" the old system over time. Never do a big-bang rewrite.
- **Case Study: Blackboard Learn (2011):** Before building blocks: commit graph shows a dense, entangled monolith. After: clean, parallel commit streams per module (Figures 13.2 and 13.3).

### Evolutionary Architecture (Amazon, 2002)
Amazon decomposed from a monolith to independent services by enforcing one rule: all team communication must happen through service APIs. No exceptions. This is the origin of the "two-pizza team + API mandate" story (Bezos memo).

### Key principle
Loosely coupled architecture enables small, independent teams to make changes and deploy safely without coordinating with other teams. Tight coupling creates the "deployment coordination tax."
