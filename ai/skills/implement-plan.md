# Implement Plan

Execute a tech plan phase by phase. Use when a reviewed plan exists and
the engineer is ready to build.

**Prerequisites:** Read `domain.md` for project vocabulary.

## When to Use

- "Implement this plan"
- "Let's start phase N"
- "Execute the combat rework plan"
- After a tech plan has been reviewed and approved

## Architecture: Orchestrator + Two Agents per Phase

The main context is the **orchestrator**. It holds the plan, tracks
state, makes decisions, and talks to the engineer. It never writes
application code itself.

Each phase runs two sequential subagents:

1. **Implement agent** — receives the phase brief, researches the
   codebase, writes all the code. Returns an implementation report.
2. **Verify agent** — receives the verify criteria and the implementation
   report, runs checks with fresh eyes. Returns a verify report.

This separation means the implement agent focuses purely on building,
and the verify agent evaluates the work without the bias of having
written it.
