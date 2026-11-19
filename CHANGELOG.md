# Changelog

All notable changes to this project are written here. The project follows [Semantic Versioning](https://semver.org/).

## [0.3.2] - 2026-11-19

### Changed

- The band's Session row now reads time, subagents, cost and lines, so cost sits under speed and lines under wifi.
- Turns and tools moved to the last row, after the rate-limit windows; that row now shows even when the account reports no limits.

### Fixed

- On a wide band the figures stopped short of the right edge while the model, effort and status sat on it; the gaps between columns now share the whole width, so the last column ends on the right edge, under the status.

## [0.3.1] - 2026-11-18

### Changed

- Wi-Fi traffic is read every 5 seconds instead of every 2.
- Wi-Fi traffic is shown in Kbps (kilobits per second, 1 Kbps = 1000 bits/s) instead of MB/s, so small traffic no longer reads as zero.

## [0.3.0] - 2026-11-18

### Added

- Wi-Fi traffic: the computer's Wi-Fi download and upload in MB/s, read every 2 seconds, in the band's System row and the System section; `off` when no Wi-Fi adapter is up.

## [0.2.0] - 2026-11-18

### Added

- Context forecast: turns left before auto-compaction or a full window, in the band and the Context section.
- What loads on every turn (memory files, MCP servers, skills, agents) and the largest tool results, in the Context section; result size per tool in the Tools section.
- Loop detector: an alert when the same call repeats four times within three minutes or three calls fail in a row.
- The effort of the last main request, in the band's header and on Overview.
- Subagents working right now, in the band's Session row ("2 running of 5"), kept true by the engine's live agent list.
- A colored mark on each row of the agent list under the prompt, a different color per agent: filled while it works, hollow once it stops.

### Changed

- Every figure in the band has a label, and every percentage (context, CPU, rate limits) uses the same ten-cell scale of full-height blocks.
- Rate limits moved to their own band row.
- The band is a grid: every column, label, meter and percentage lines up across rows, gaps grow with the width, and narrow bands drop whole columns from the right. A loop alert gets its own row.

### Fixed

- CPU and rate-limit bars below 70% were drawn without color; they now follow the context scale (green, amber from 70%, red from 95%).

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
