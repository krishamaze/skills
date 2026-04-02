# Org Design, Conway's Law & Team Topology

Source: Part II (Ch. 05–08), The DevOps Handbook 2nd Ed.

---

## Conway's Law (Ch. 07)

> "Organizations which design systems are constrained to produce designs which are copies of the communication structures of those organizations."
> — Melvin Conway, 1968

**Inverse Conway Maneuver:** Don't let your org structure dictate your architecture. Instead, design your desired architecture first, then restructure teams to match it.

### Functional vs. Market Orientation (Figure 7.1)
- **Functional (anti-pattern):** All work flows through centralized Ops. Dev teams open tickets to deploy. Ops team is a bottleneck optimized for cost, not speed.
- **Market orientation (target):** Each product team can independently develop, test, and deploy their loosely coupled components. Platform team provides self-service infrastructure.

### Case Study: Conway's Law at Etsy (2015)
Etsy deliberately reorganized into cross-functional teams aligned to business capabilities. Architecture decoupled accordingly. Result: dramatically faster deployment frequency.

### Case Study: API Enablement at Target (2015)
Target restructured around APIs to decouple teams. Each product team owned its API contract, enabling independent deployment. Architecture followed team structure.

---

## Team Topology Principles

### Staff Archetypes (Table 7.1)
| Type | Description | Problem |
|------|-------------|---------|
| **I-shaped (Specialist)** | Deep expertise, narrow skills | Creates bottlenecks, insensitive to downstream waste |
| **T-shaped (Generalist)** | One deep area + broad coverage | Can remove bottlenecks, absorbs variability |
| **E-shaped** | Deep in a few areas + proven execution + always innovating | Almost limitless potential |

Target: Build teams toward T and E-shaped staff. Specialists are necessary but bottleneck-prone.

### Long-Lived, Multiskilled Teams (Figure 8.1)
Replace functional silos (separate Dev, QA, Ops, DBA teams) with long-lived, cross-functional product teams. Each team owns its full stack — development, testing, and operations.

Key: Teams must be **long-lived** (not project-based). Project teams form, ship, and disband — they never accumulate operational knowledge. Product teams own the service for years.

### Two-Pizza Teams
Amazon principle: teams small enough to be fed by two pizzas (~6–10 people). Small teams have lower coordination overhead and move faster.

### Case Study: Big Fish Games (2014)
Big Fish reorganized from functional silos into cross-functional DevOps teams. Each team owned a service end-to-end. Deployment frequency and quality improved significantly.

### Case Study: Nationwide Building Society (2020)
Nationwide shifted from project-centric to product-centric teams. Cross-functional, long-lived teams reduced handoff waste and improved developer ownership.

---

## Value Stream Selection (Ch. 05)

### Where to Start a DevOps Transformation
The book is explicit: don't try to transform everything at once. Select ONE value stream as the pilot.

**Selection criteria:**
1. **Greenfield vs. Brownfield:** Greenfield (new services) are easier but smaller impact. Brownfield (existing critical systems) are harder but where most organizations live.
2. **Systems of engagement vs. systems of record:** Start with systems of engagement (customer-facing, high change rate). Systems of record (billing, ERP) are higher risk.
3. **Innovators and early adopters:** Find the team that WANTS to change. Don't start with skeptics.

### Case Study: Nordstrom's DevOps Transformation (2014–2015)
Nordstrom selected e-commerce as their initial value stream — high customer impact, relatively decoupled architecture. Success there built political capital to expand the transformation.

### Case Study: Kessel Run / US Air Force (2020)
Brownfield transformation of a mid-air refueling system. Demonstrates that even high-stakes, compliance-heavy government systems can adopt DevOps. Key: dedicated transformation team, separated from the legacy org.

### Case Study: HMRC UK Tax Authority (2020)
Government agency managing tax collection built a hyperscale PaaS to dramatically accelerate value stream delivery across hundreds of teams. Shared platform absorbed complexity so product teams could focus on value.

### Dedicated Transformation Team
When transforming a brownfield system, the book recommends creating a separate, dedicated transformation team that operates outside normal bureaucratic constraints — similar to a skunkworks. They define the target state, prove it works, then expand.

---

## Integrating Operations into Development (Ch. 08)

### The Core Problem
Traditional model: Dev builds it, throws it over the wall to Ops to run it. Ops has no context. Incidents are painful. Nobody is happy.

### Solutions from the Book

1. **Embed Ops into Dev teams** — Ops engineers join product teams, bringing operational perspective upstream into design and development.
2. **Create self-service Ops capabilities** — Build internal platforms that let Dev teams provision infrastructure, deploy, and monitor without Ops tickets.
3. **Shared on-call** — Developers participate in on-call rotation for their own services. "You build it, you run it" (Amazon principle).
4. **Production readiness reviews** — Before a service launches, run a readiness checklist: monitoring in place? Deployment automated? Runbooks written? Rollback tested?

### Case Study: Big Fish Games (2014)
Ops team was embedded into Dev squads. Result: infrastructure concerns were addressed during design, not after launch.
