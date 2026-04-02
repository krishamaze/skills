# DevSecOps: Integrating Security, Change Management & Compliance

Source: Part VI (Ch. 22–23), The DevOps Handbook 2nd Ed.

---

## The Core DevSecOps Argument

Traditional security model: security reviews happen at the end of the project, just before launch. This is too late, too slow, and creates the "security as the department of 'no'" dynamic.

DevSecOps reframes security as everyone's job, every day — integrated into the deployment pipeline, automated where possible, shifted left to where defects are cheapest to fix.

The book draws a direct parallel: just as quality cannot be inspected in at the end of a manufacturing line, security cannot be added in at the end of a development cycle.

---

## Shifting Security Left (Ch. 22)

### What "Shift Left" Means
Move security controls upstream — into development, not just production. Developers write code with security awareness. Security tests run in the pipeline. Vulnerabilities surface in hours, not months.

### Static Security Testing (SAST)
Automated tools that scan source code for security vulnerabilities on every commit, integrated into the CI pipeline.

**Case Study: Static Security Testing at Twitter (2009)**
Twitter integrated Brakeman (a Ruby static analysis tool) into their CI pipeline. Every commit triggered a security scan. The number of detected vulnerabilities tracked over time (Figure 22.2) showed the system was catching issues continuously, not episodically. Time to remediate vs. time to update dependencies became a tracked metric (Figure 22.3).

**Case Study: Jenkins Running Automated Security Testing (Figure 22.1)**
Shows a CI/CD pipeline with security test stages embedded alongside unit tests and integration tests. Security is not a gate at the end — it is a stage in the flow.

### Dependency Vulnerability Scanning
Track open-source dependencies. When a CVE (Common Vulnerability and Exposure) is published for a library you use, automated scanning surfaces it immediately.
- National Vulnerability Database (NVD) as the source of truth
- Figure 22.4: Five behavioral clusters for open-source projects by update velocity and security posture
- Automate: when a dependency has a known CVE, create a ticket automatically

### Case Study: Shifting Security Left at Fannie Mae (2020)
Fannie Mae — a highly regulated financial institution — embedded security controls into their deployment pipeline. Security teams shifted from gatekeepers to enablers: they defined the automated checks, developers ran them on every commit. Security review time dropped; vulnerability detection rate increased.

### Developer Security Training
The book recommends that security teams run regular "security games" — giving developers hands-on experience attacking and defending systems. When developers understand what SQL injection looks like from the attacker's perspective, they stop writing vulnerable code.

### Case Study: Instrumenting the Environment at Etsy (2010)
Etsy embedded security telemetry directly into production. Developers could see SQL injection attempts in real-time via Graphite dashboards (Figure 22.5). Security became visible to everyone, not just the security team.

---

## Compliance as Code (Ch. 22)

### The Traditional Problem
Compliance frameworks (PCI-DSS, SOC2, HIPAA, FedRAMP) require documentation, audit trails, and control evidence. Traditional approach: manually collect evidence at audit time. Slow, error-prone, and often results in emergency scrambles.

### Compliance as Code
Treat compliance controls as code. Automated tests verify controls continuously. Audit evidence is generated automatically by the pipeline.

**Case Study: 18F and Compliance Masonry (2016)**
18F (US Federal Government digital services agency) built Compliance Masonry — a tool that maps automated compliance checks to specific NIST controls. Every deployment generates a compliance artifact. Audits become reports rather than investigations. (Note: 18F's contribution is in the public domain by waiver.)

---

## Protecting the Deployment Pipeline (Ch. 23)

### Change Management Integration
Traditional change management: human review board approves every change before it goes to production. This creates massive batch sizes (bundle many changes to justify one CAB meeting), long lead times, and perverse incentives (hide small changes to avoid the process).

**DevOps approach:** Define change categories:
- **Standard changes (pre-approved):** Low-risk, well-understood, automated. Go straight to production. No CAB required.
- **Normal changes:** Review required, but lightweight and fast.
- **Emergency changes:** Fast-track process for critical fixes.

The goal is to move as many changes as possible into the "standard" category through automation and track record.

**Case Study: Automated Infrastructure Changes at Salesforce.com (2012)**
Salesforce automated infrastructure changes through their pipeline, creating an audit trail that satisfied their change management requirements. Changes that would previously have required a CAB review became standard changes with full traceability.

### PCI Compliance and Separation of Duties (Etsy, 2014)
Etsy navigated PCI-DSS compliance (required for credit card processing) while maintaining deployment velocity. Key insight: PCI doesn't require manual gates; it requires audit trails and controls. Automated controls with full audit logs can satisfy PCI requirements while enabling continuous delivery.

**Case Study: Capital One — Ten "No Fear Releases" Per Day (2020)**
Capital One (a bank, highly regulated) achieved 10+ production deployments per day. How: automated compliance checks in the pipeline, immutable infrastructure, full audit trails. Compliance was preserved through automation, not through slowing down.

### Case Study: Proving Compliance in Regulated Environments (2015)
General framework from the book: the key is to make your controls auditable and automated. Regulators care about evidence of controls, not about the specific mechanism. Manual gate = evidence. Automated test with log = also evidence, but faster.

### Telemetry for Compliance (ATM Systems, 2013)
Regulated financial institutions used production telemetry as compliance evidence — demonstrating that controls were operating correctly in real-time, not just at audit time.

---

## Key Principle Summary

| Traditional Security | DevSecOps |
|---------------------|-----------|
| Review at end | Test on every commit |
| Security team's job | Everyone's job |
| Manual evidence collection | Automated audit trail |
| Vulnerability found at launch | Vulnerability found at commit |
| CAB for all changes | Standard/normal/emergency tiers |
| Compliance slows delivery | Compliance automation enables delivery |
