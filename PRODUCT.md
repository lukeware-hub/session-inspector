# Product

<!-- impeccable:product-schema 1 -->

## Platform

terminal: a Claude Code mod drawn with Claude Code's own interface elements (terminal first, desktop app as a second surface). No web page.

## Users

Developers who run long Claude Code sessions, often with subagents, and need to see at a glance how full the context window is, what the session is costing, and what the agent is doing, without leaving the prompt.

## Product Purpose

Session Inspector observes the current Claude Code session and shows its live state: context usage, session progress, tools, agents, files touched, git changes, cost and rate limits, speed, and the resources of the Claude Code processes. Success means the developer acts before the context fills up or a limit is hit, and can explain what a session did.

## Positioning

It runs inside Claude Code as a native mod, reading the engine's own events and figures, so every number is the session's real data, never an estimate of its own (the cost is labelled as Claude Code's estimate).

## Constraints

- Observer only: never changes, blocks or approves anything.
- Keeps no tool arguments, file contents, prompts, model answers or credentials; file paths are the only argument it records.
- No network access. The only host commands are read-only: `git` for line counts and the operating system's process listing for CPU and memory.
- Uses only the mod interface Claude Code ships; values it cannot obtain are shown as missing, never guessed.
- Plugin name `session-inspector` (names starting with `claude-` are reserved by Claude Code).
