# Decisions

## ADR-001: Adapter pattern for platforms
**Status:** active
**Decision:** Every platform is a pluggable adapter. Same interface, different connector.
**Do not:** Hardcode any platform logic into core.

## ADR-002: HITL always
**Status:** active
**Decision:** Human approves every reply. No exceptions. No auto-send.
**Do not:** Add any auto-send logic even for "safe" replies.
