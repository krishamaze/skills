# Three Ways — Deep Reference

Source: Part I, The DevOps Handbook 2nd Ed.

---

## The First Way: Flow (Ch. 02)

**Goal:** Make work visible, reduce batch sizes, eliminate waste in the value stream.

### Core Concepts

- **Value Stream:** All steps from business hypothesis to customer-delivered value. Technology value streams include: product owner → dev → test → ops → customer.
- **Lead Time vs. Process Time:** Lead time = ticket created → work delivered. Process time = work started → work completed. The gap between them is pure waste.
- **Work in Process (WIP):** Limiting WIP reduces multitasking and increases throughput. High WIP = slow flow.
- **Small Batch Sizes:** Small batches move faster, have fewer defects, and give faster feedback. Large batches create the "big bang" deployment problem.
- **Kanban Boards:** Visualize work and WIP limits. Span all stages: requirements → dev → test → staging → production.

### Case Study: American Airlines (2020) — Part 1
AA underwent a full DevOps transformation across a complex brownfield environment. Key vocabulary shift: from "when will this project be done?" to "when do we start seeing value?" They measured improvement across deployment frequency, development cycle time, change failure rate, MTTR, and number of incidents over a 3-year journey.

### Case Study: Flow and Constraint Management in Healthcare (2021)
Applied Theory of Constraints to identify the bottleneck in a healthcare delivery value stream, demonstrating that optimizing non-bottleneck steps is wasted effort.

### Waste Types to Eliminate
Partially done work, extra processes, extra features, task switching, waiting, motion, defects, nonstandard/manual work.

---

## The Second Way: Feedback (Ch. 03)

**Goal:** Create fast feedback loops at every stage so problems surface immediately.

### Core Concepts

- **Feedback cycle times:** Unit tests (seconds) → integration tests (minutes) → exploratory testing (hours) → statistical analysis of production metrics (days). Faster = better.
- **Seeing problems as they occur:** Telemetry, logging, and alerting that surface issues in real time, not after the fact.
- **Swarm and solve:** When a problem is detected, stop the line and swarm it (like Toyota's Andon cord) rather than pushing work downstream.
- **Quality at the source:** Don't pass defects downstream. Build quality in.

### The Andon Cord (Toyota Production System)
Any worker can halt the production line when a defect is detected. The goal is never to pass a known defect to the next stage. Applied to software: any developer can halt the build/pipeline when tests fail.

### Case Study: Pulling the Andon Cord at Excella (2018)
Excella introduced a team-level Andon cord practice. When cycle time spiked, the cord was pulled and the team swarmed the problem. Data showed cycle time and Andon cord pulls were inversely correlated — pulling the cord kept cycle time low.

### Westrum Organizational Typology
| Type | Information Flow | Failure Response | Bridging |
|------|-----------------|-----------------|---------|
| **Pathological** | Hidden | Blamed | Discouraged |
| **Bureaucratic** | Ignored | Tolerated | Allowed but unwanted |
| **Generative** | Actively sought | Used for learning | Rewarded |

Target: Generative culture. It produces higher software delivery performance.

---

## The Third Way: Continual Learning & Experimentation (Ch. 04)

**Goal:** Create a culture of psychological safety, learning from failure, and converting local discoveries to global improvements.

### Core Concepts

- **Just Culture:** Distinguish between human error, at-risk behavior, and reckless behavior. Blame is counterproductive; systemic fixes are the goal.
- **Blameless Postmortems:** Assume good intent. Focus on what failed in the system, not who failed. Publish findings widely.
- **Improvement Kata (Toyota):** Plan → Do → Check → Act. Continuous, small improvement cycles rather than episodic big projects.
- **Resilience Patterns:** Practice failure. Netflix Chaos Monkey deliberately injects faults to ensure systems recover gracefully.
- **Local → Global Knowledge:** When one team discovers something, institutionalize it so all teams benefit.

### Case Study: Bell Labs (1925)
Bell Labs demonstrates that creating the conditions for experimentation — dedicated time, cross-disciplinary teams, shared infrastructure — produces outsized innovation. The lesson: organizational conditions matter as much as individual talent.

### Leader's Role in the Third Way
- Create time and space for improvement (not just feature delivery)
- Model the learning behavior (admit your own mistakes publicly)
- Reward risk-taking and experimentation, even when it fails
- Protect improvement time from being cannibalized by urgent work

---

## Value Stream Fundamentals

**Technology Value Stream:** The process of converting a business hypothesis into a technology-enabled service delivering value to customers.

**Key Metrics per Stage:**
- **%C/A (Percent Complete and Accurate):** What % of work handed to the next stage is correct? Low %C/A = upstream quality problems.
- **Lead Time per stage:** Where is work sitting idle?

**Example from the book (Figure 6.1):** A real value stream map showed 10 weeks total lead time with only 7.5 days of actual value-added work — meaning 86% of time was pure wait/waste. %C/A cascaded down to 8.6% overall.

**Value Stream Mapping Steps:**
1. Identify the value stream (one product/service, not the whole org)
2. Map all steps from customer request to delivery
3. Measure lead time, process time, and %C/A at each step
4. Find the bottleneck (the constraint — Theory of Constraints)
5. Exploit, then elevate the constraint
6. Repeat

**20% Rule:** Reserve 20% of capacity for positive, user-invisible work: architecture improvements, non-functional requirements, technical debt reduction, process improvement. Without this, technical debt compounds until delivery grinds to a halt.
