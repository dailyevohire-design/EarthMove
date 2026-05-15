# ADR 0004 — Single-agent SMS dispatch (Sarah/Jesse), not managed multi-agent

**Status:** Accepted · **Date:** 2026-05-15

## Context
The Sarah (customer-facing) and Jesse (driver-facing) SMS brains could be built as Anthropic managed multi-agent flows with sub-agent tool calls. Multi-agent adds 500ms-2s latency per turn and 3-10x token spend versus single-agent. SMS UX targets sub-3s response.

## Decision
Keep Sarah and Jesse as separate single-agent flows in standalone Python services calling the Anthropic Messages API directly. Strict tool allowlist per brain. Cross-brain coordination happens at the database layer (shared `dispatch_orders` table, shared `dispatches`) rather than via callable inter-agent invocations.

## Consequences
- Sub-3s response targets met routinely
- ~70% lower per-message cost vs multi-agent prototype
- Better observability — every tool call is a single trace span, not a tree
- Trade-off: less generalized than full agentic; new cross-brain behaviors require code, not prompt
- Revisit when latency budget grows (e.g. async post-handoff workflows)

## Alternatives considered
- Anthropic managed agent with sub-agent calls — rejected on latency + cost
- LangGraph multi-agent — rejected on operational complexity
