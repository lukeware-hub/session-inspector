# Changelog

All notable changes to this project are written here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Context forecast: turns left before auto-compaction or a full window, in the band and the Context section.
- What loads on every turn (memory files, MCP servers, skills, agents) and the largest tool results, in the Context section; result size per tool in the Tools section.
- Loop detector: an alert when the same call repeats four times within three minutes or three calls fail in a row.

## [0.1.0] - 2026-11-18

### Added

- Footer band above the prompt with context usage, tokens, model, session status, tool count and alerts.
- Inspector pane opened with `/inspector [section]`, with the sections Overview, Context, Session, Activity, Tools, Agents, Files and System.
- Context monitor with the levels Normal, Attention, High and Critical, a history of 12 readings and a notification when usage rises into High or Critical.
- Session monitor with id, status, start and end time, duration, turns, tool calls, model and token totals.
- Activity timeline of the last 50 events.
- Tools monitor built from the tools that actually ran.
- Agents monitor built from the subagents the session actually started.
- State kept in Claude Code's session state, preserved across hot reloads and started over for a new session.
- Tests for the domain functions and integration tests against Claude Code's test kit.
- Framed footer band with Context, Session and System rows; it drops the frame when there is little room.
- Cost estimate and rate limits reported by Claude Code.
- Breakdown of what fills the context window, and a count of compactions.
- Files section: files read and edited by tools, and lines added and removed since the session began (git).
- Tool durations, the slowest tools, permission denials, and MCP calls grouped by server.
- Model speed in tokens per second.
- System section: CPU and memory of the Claude Code process tree.
- Marketplace manifest, continuous integration and documentation.
